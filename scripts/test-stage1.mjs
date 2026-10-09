import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const worker = require(resolve(import.meta.dirname, "../release/luyouclub-cloudbase/worker.cjs"));
const rows = [];
const auditLogs = [];

function valuesToSignup(values) {
  const [
    id, createdAt, updatedAt, activityId, userId, name, phone, wechat, role,
    gender, age, zodiac, work, home, pickup, vehicle, licensePlate, seats,
    note, smoking, acceptsSmoking, roomType, modificationsJson,
    modificationOther, depositStatus, interestsJson, signupStatus,
    contactConsent, notificationConsent
  ] = values;
  return {
    id, createdAt, updatedAt, activityId, userId, name, phone, wechat, role,
    gender, age, zodiac, work, home, pickup, vehicle, licensePlate, seats,
    note, smoking, acceptsSmoking, roomType, modificationsJson,
    modificationOther, depositStatus, interestsJson, signupStatus,
    contactConsent, notificationConsent, status: "待匹配"
  };
}

const DB = {
  async writeAudit(record) {
    auditLogs.push(record);
  },
  prepare(sql) {
    const executeAll = (bindings = []) => {
      const activityId = bindings[0];
      const filtered = activityId
        ? rows.filter((row) => row.activityId === activityId)
        : rows;
      return {
        results: [...filtered].sort((a, b) =>
          String(b.createdAt).localeCompare(String(a.createdAt))
        )
      };
    };
    return {
      bind(...values) {
        return {
          async run() {
            if (sql.includes("INSERT INTO signups")) {
              const record = valuesToSignup(values);
              const index = rows.findIndex((item) =>
                item.activityId === record.activityId && item.phone === record.phone
              );
              if (index >= 0) rows[index] = { ...record, id: rows[index].id };
              else rows.push(record);
            }
            return { success: true };
          },
          async all() {
            return executeAll(values);
          }
        };
      },
      async all() {
        return executeAll();
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

async function signup(activityId, name) {
  return call(`/api/v1/activities/${activityId}/signups`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name,
      phone: "13900000000",
      wechat: `wx_${name}`,
      role: "rider",
      work: "海淀",
      home: "朝阳",
      depositConfirmed: true,
      contactConsent: true,
      notificationConsent: true
    })
  });
}

assert.equal((await signup("activity-a", "成员甲")).status, 201);
assert.equal((await signup("activity-b", "成员乙")).status, 201);
assert.equal(rows.length, 2);
assert.deepEqual(rows.map((row) => row.activityId).sort(), ["activity-a", "activity-b"]);

const login = await call("/api/admin/login", {
  method: "POST",
  redirect: "manual",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: "password=test-password"
});
const cookie = login.headers.get("set-cookie")?.split(";", 1)[0];
assert.ok(cookie);

const exported = await call("/api/v1/admin/activities/activity-a/signups/export.csv", {
  headers: { cookie }
});
assert.equal(exported.status, 200);
assert.match(exported.headers.get("content-type") || "", /text\/csv/);
assert.match(exported.headers.get("content-disposition") || "", /attachment/);
const csvBytes = new Uint8Array(await exported.arrayBuffer());
assert.deepEqual([...csvBytes.slice(0, 3)], [0xef, 0xbb, 0xbf]);
const csv = new TextDecoder().decode(csvBytes);
assert.match(csv, /成员甲/);
assert.doesNotMatch(csv, /成员乙/);
assert.equal(auditLogs.length, 1);
assert.equal(auditLogs[0].action, "signups.export");

console.log("Stage 1 activity scoping and signup export passed.");
