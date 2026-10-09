import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const worker = require(resolve(import.meta.dirname, "../release/luyouclub-cloudbase/worker.cjs"));
const serverSource = readFileSync(resolve(import.meta.dirname, "../cloudbase/server.cjs"), "utf8");
if (!serverSource.includes("requireProductionEnv")) {
  throw new Error("CloudBase server must reject missing production secrets");
}
const workerSource = readFileSync(resolve(import.meta.dirname, "../worker/index.template.js"), "utf8");
if (!workerSource.includes("constantTimeEqual")) {
  throw new Error("Admin session signatures must use constant-time comparison");
}
const rows = [];
const preparedSql = [];

function valuesToRecord(values) {
  const [id, createdAt, updatedAt, activityId, userId, name, phone, wechat, role, gender, age, zodiac, work, home, pickup, vehicle, licensePlate, seats, note, smoking, acceptsSmoking, roomType, modificationsJson, modificationOther, depositStatus, interestsJson, signupStatus, contactConsent, notificationConsent] = values;
  return { id, createdAt, updatedAt, status: "待匹配", activityId, userId, name, phone, wechat, role, gender, age, zodiac, work, home, pickup, vehicle, licensePlate, seats, note, smoking, acceptsSmoking, roomType, modificationsJson, modificationOther, depositStatus, interestsJson, signupStatus, contactConsent, notificationConsent };
}

const DB = {
  prepare(sql) {
    preparedSql.push(sql);
    return {
      bind(...values) {
        if (values.length !== 29) throw new Error(`signup bind contract changed: expected 29 values, received ${values.length}`);
        return {
          async run() {
            const record = valuesToRecord(values);
            const index = rows.findIndex(item => item.activityId === record.activityId && item.phone === record.phone);
            if (index >= 0) rows[index] = { ...rows[index], ...record, id: rows[index].id };
            else rows.push(record);
            return { success: true };
          }
        };
      },
      async all() {
        return { results: [...rows].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))) };
      }
    };
  }
};

const env = {
  DB,
  TEST_MODE: "true",
  ADMIN_PASSWORD: "test-password",
  ADMIN_SESSION_SECRET: "test-secret-that-is-long-enough-123456"
};

async function call(path, init = {}) {
  return worker.fetch(new Request(`https://luyouclub.test${path}`, init), env, {});
}

for (const route of ["/", "/trip", "/signup?role=owner", "/signup?role=rider", "/api/health"]) {
  const response = await call(route);
  if (!response.ok) throw new Error(`${route} returned ${response.status}`);
}

const preflight = await call("/api/signup", {
  method: "OPTIONS",
  headers: {
    origin: "https://miniapp-preview.example",
    "access-control-request-method": "POST",
    "access-control-request-headers": "content-type"
  }
});
if (preflight.status !== 204 || preflight.headers.get("access-control-allow-origin") !== "*") {
  throw new Error("public API CORS preflight failed");
}

const activities = await call("/api/activities", {
  headers: { origin: "https://miniapp-preview.example" }
});
if (!activities.ok || activities.headers.get("access-control-allow-origin") !== "*") {
  throw new Error("public activity API is missing CORS headers");
}

const qr = await call("/assets/deposit-qr.jpg");
if (!qr.ok || qr.headers.get("content-type") !== "image/jpeg" || (await qr.arrayBuffer()).byteLength < 10000) throw new Error("deposit QR asset failed");

const unpaid = await call("/api/signup", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ name: "未付定金", phone: "13900000009", role: "rider", work: "海淀", home: "朝阳" })
});
if (unpaid.status !== 400) throw new Error("unpaid signup should be rejected");

const rider = await call("/api/signup", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ name: "云端测试搭车", phone: "13900000000", wechat: "test_rider", role: "rider", gender: "女", work: "海淀", home: "朝阳", smoking: "不吸烟", acceptsSmoking: "不接受", roomType: "标间", depositConfirmed: true, interests: ["摄影"], note: "希望安静同行" })
});
if (!rider.ok || !(await rider.json()).ok) throw new Error("rider signup failed");

const owner = await call("/api/signup", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ name: "云端测试车主", phone: "13900000001", wechat: "test_owner", role: "owner", gender: "男", work: "朝阳", home: "朝阳", vehicle: "SUV", licensePlate: "京A12345", seats: 2, smoking: "不吸烟", acceptsSmoking: "不接受", roomType: "标间", modifications: ["轮胎", "绞盘"], depositConfirmed: true, interests: ["摄影"] })
});
if (!owner.ok || !(await owner.json()).ok) throw new Error("owner signup failed");

const signupInsert = preparedSql.find(sql => sql.includes("INSERT INTO signups"));
for (const column of ["activity_id", "user_id", "wechat", "license_plate", "modifications_json", "deposit_status", "interests_json", "signup_status", "contact_consent", "notification_consent"]) {
  if (!signupInsert?.includes(column)) throw new Error(`signup SQL contract missing column: ${column}`);
}
if (!signupInsert?.includes("ON CONFLICT(activity_id, phone)")) throw new Error("signup SQL must use the activity and phone composite key");

const login = await call("/api/admin/login", {
  method: "POST",
  redirect: "manual",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: "password=test-password"
});
const cookie = login.headers.get("set-cookie")?.split(";", 1)[0];
if (login.status !== 303 || !cookie) throw new Error("admin login failed");

const admin = await call("/admin?tab=plan", { headers: { cookie } });
const adminHtml = await admin.text();
for (const expected of ["云端测试车主", "云端测试搭车", "test_owner", "test_rider", "住宿安排", "希望安静同行", "住宿：标间", "定金：待核验"]) {
  if (!adminHtml.includes(expected)) throw new Error(`admin output missing: ${expected}`);
}

console.log("CloudBase package routes, signup persistence, preferences, admin login and automatic plans passed.");
