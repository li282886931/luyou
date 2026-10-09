import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const worker = require(resolve(import.meta.dirname, "../release/luyouclub-cloudbase/worker.cjs"));
const rows = [
  {
    id: "owner-1", activityId: "trip-stage5", name: "路线车主", phone: "13900000101",
    wechat: "owner", role: "owner", work: "海淀", home: "望京", pickup: "望京站",
    vehicle: "SUV", licensePlate: "京A10001", seats: 2, smoking: "不吸烟",
    acceptsSmoking: "不接受", roomType: "单间", interests: ["摄影"],
    modifications: [], status: "待匹配", signupStatus: "已报名", depositStatus: "已确认",
    contactConsent: true, notificationConsent: true, createdAt: "2026-09-28T00:00:00Z"
  },
  {
    id: "rider-1", activityId: "trip-stage5", name: "路线乘客", phone: "13900000102",
    wechat: "rider", role: "rider", work: "海淀", home: "酒仙桥", pickup: "酒仙桥站",
    vehicle: "", licensePlate: "", seats: 0, smoking: "不吸烟",
    acceptsSmoking: "不接受", roomType: "单间", interests: ["摄影"],
    modifications: [], status: "待匹配", signupStatus: "已报名", depositStatus: "已确认",
    contactConsent: true, notificationConsent: true, createdAt: "2026-09-28T00:00:01Z"
  }
];
const locations = new Map([
  ["owner-1", { pickupLat: 39.998, pickupLng: 116.470 }],
  ["rider-1", { pickupLat: 39.982, pickupLng: 116.455 }]
]);
const generations = [];
const mediaAssets = [];
const operations = [];
const matchRuns = [];
const assignments = [];

const DB = {
  async saveContentGeneration(record) {
    generations.push(record);
    return record;
  },
  async createMediaAsset(record) {
    mediaAssets.push(record);
    return record;
  },
  async uploadMedia(name, type, bytes) {
    return { fileId: `club-media/${name}`, name, type, size: bytes.byteLength };
  },
  async resolveMedia(items) {
    return items.map((item) => ({ ...item, url: `https://signed.test/${item.fileId}` }));
  },
  async attachSignupLocations(nextRows) {
    return nextRows.map((row) => ({ ...row, ...(locations.get(row.id) || {}) }));
  },
  async saveMatchRun(run, nextAssignments) {
    matchRuns.push(run);
    assignments.push(...nextAssignments);
    return { ...run, assignments: nextAssignments };
  },
  async getLatestMatchRun(activityId) {
    const run = [...matchRuns].reverse().find((item) => item.activityId === activityId);
    return run ? { ...run, assignments: assignments.filter((item) => item.matchRunId === run.id) } : null;
  },
  async updateSignupLifecycle(signupId, change, operation) {
    const row = rows.find((item) => item.id === signupId);
    Object.assign(row, change);
    operations.push(operation);
    return row;
  },
  async listSignupOperations(activityId) {
    return operations.filter((item) => item.activityId === activityId);
  },
  async writeAudit() {},
  prepare(sql) {
    void sql;
    const selectRows = async (bindings = []) => ({
      results: rows.filter((row) => !bindings[0] || row.activityId === bindings[0])
    });
    return {
      bind(...bindings) {
        return { async all() { return selectRows(bindings); } };
      },
      async all() {
        return selectRows();
      }
    };
  }
};

const env = {
  DB,
  TEST_MODE: "true",
  ADMIN_PASSWORD: "test-password",
  ADMIN_SESSION_SECRET: "test-secret-that-is-long-enough-123456",
  MEDIA_ANALYZER: async () => ({
    focusX: 0.72,
    focusY: 0.38,
    coverScore: 91,
    cropSuggestions: [
      { ratio: "16:9", x: 0.22, y: 0.08, width: 0.72, height: 0.72 }
    ]
  })
};

async function call(path, init = {}) {
  return worker.fetch(new Request(`https://luyouclub.test${path}`, init), env, {});
}

const login = await call("/api/admin/login", {
  method: "POST",
  redirect: "manual",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: "password=test-password"
});
const cookie = login.headers.get("set-cookie")?.split(";", 1)[0];
assert.ok(cookie);

const generationResponse = await call("/api/v1/admin/content/generations", {
  method: "POST",
  headers: { cookie, "content-type": "application/json" },
  body: JSON.stringify({
    activityId: "trip-stage5",
    title: "秋日坝上穿越",
    route: "北京 -> 张北 -> 桦皮岭",
    audience: "周末自驾爱好者",
    highlights: ["草原日落", "轻越野", "车友社交"]
  })
});
assert.equal(generationResponse.status, 201);
const generation = await generationResponse.json();
assert.equal(generation.variants.length, 3);
assert.deepEqual(generation.variants.map((item) => item.template), ["magazine", "route", "social"]);
assert.ok(generation.variants.every((item) => item.blocks.length >= 3));
assert.equal(generations.length, 1);

const mediaForm = new FormData();
mediaForm.set("activityId", "trip-stage5");
mediaForm.set("file", new File(["image-content"], "stage5-cover.jpg", { type: "image/jpeg" }));
const mediaResponse = await call("/api/v1/admin/media", {
  method: "POST",
  headers: { cookie },
  body: mediaForm
});
assert.equal(mediaResponse.status, 200);
const media = (await mediaResponse.json()).media;
assert.equal(media.focusX, 0.72);
assert.equal(media.coverScore, 91);
assert.equal(media.cropSuggestions[0].ratio, "16:9");
assert.equal(mediaAssets[0].focusY, 0.38);

const matchResponse = await call("/api/v1/admin/activities/trip-stage5/matches/runs", {
  method: "POST",
  headers: { cookie }
});
assert.equal(matchResponse.status, 201);
const match = await matchResponse.json();
assert.equal(match.assignments.length, 1);
assert.ok(match.assignments[0].distanceKm > 0);
assert.match(match.assignments[0].reasons.join("、"), /公里/);

const waitlist = await call("/api/v1/admin/signups/rider-1/lifecycle", {
  method: "POST",
  headers: { cookie, "content-type": "application/json" },
  body: JSON.stringify({ action: "waitlist", note: "活动名额已满" })
});
assert.equal(waitlist.status, 200);
assert.equal(rows[1].signupStatus, "候补");

const refund = await call("/api/v1/admin/signups/rider-1/lifecycle", {
  method: "POST",
  headers: { cookie, "content-type": "application/json" },
  body: JSON.stringify({ action: "refund", amount: 200, note: "原路退款" })
});
assert.equal(refund.status, 200);
assert.equal(rows[1].depositStatus, "已退款");

const checkin = await call("/api/v1/admin/signups/owner-1/lifecycle", {
  method: "POST",
  headers: { cookie, "content-type": "application/json" },
  body: JSON.stringify({ action: "checkin" })
});
assert.equal(checkin.status, 200);
assert.equal(operations.filter((item) => item.type === "checkin").length, 1);

const dashboardResponse = await call("/api/v1/admin/activities/trip-stage5/dashboard", {
  headers: { cookie }
});
assert.equal(dashboardResponse.status, 200);
const dashboard = await dashboardResponse.json();
assert.equal(dashboard.signups.total, 2);
assert.equal(dashboard.signups.waitlist, 1);
assert.equal(dashboard.finance.refundedAmount, 200);
assert.equal(dashboard.checkin.checkedIn, 1);
assert.equal(dashboard.matching.matched, 1);

const adminHtml = readFileSync(resolve(import.meta.dirname, "../site/index.html"), "utf8");
const adminScript = readFileSync(resolve(import.meta.dirname, "../site/app.js"), "utf8");
assert.match(adminHtml, /id="layoutGenerator"/);
assert.match(adminHtml, /id="dashboardWaitlist"/);
assert.match(adminScript, /\/api\/v1\/admin\/content\/generations/);
assert.match(adminScript, /\/dashboard/);
assert.match(adminScript, /data-lifecycle/);

console.log("Stage 5 layouts, media analysis, operations dashboard and route distance passed.");
