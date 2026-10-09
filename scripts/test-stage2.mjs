import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const worker = require(resolve(import.meta.dirname, "../release/luyouclub-cloudbase/worker.cjs"));
const rows = [];
const capabilities = new Map();
const matchRuns = [];
const assignments = [];
const notifications = [];
const auditLogs = [];
const sentMessages = [];

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
    contactConsent: Boolean(contactConsent),
    notificationConsent: Boolean(notificationConsent),
    status: "待匹配"
  };
}

const DB = {
  async saveSignupCapability(record) {
    capabilities.set(record.signupId, record.tokenHash);
  },
  async findSignupByCapability(signupId, tokenHash) {
    return capabilities.get(signupId) === tokenHash
      ? rows.find((row) => row.id === signupId) || null
      : null;
  },
  async saveMatchRun(run, nextAssignments) {
    matchRuns.push({ ...run });
    assignments.push(...nextAssignments.map((item) => ({ ...item })));
    return { ...run, assignments: nextAssignments.map((item) => ({ ...item })) };
  },
  async getLatestMatchRun(activityId) {
    const run = [...matchRuns].reverse().find((item) => item.activityId === activityId);
    if (!run) return null;
    return {
      ...run,
      assignments: assignments.filter((item) => item.matchRunId === run.id)
    };
  },
  async getMatchRun(runId) {
    const run = matchRuns.find((item) => item.id === runId);
    if (!run) return null;
    return {
      ...run,
      assignments: assignments.filter((item) => item.matchRunId === run.id)
    };
  },
  async getMatchRunByAssignment(assignmentId) {
    const assignment = assignments.find((item) => item.id === assignmentId);
    return assignment ? this.getMatchRun(assignment.matchRunId) : null;
  },
  async updateMatchAssignment(record) {
    const index = assignments.findIndex((item) => item.id === record.id);
    if (index < 0) return null;
    assignments[index] = { ...assignments[index], ...record };
    return { ...assignments[index] };
  },
  async confirmMatchRun(runId, confirmedAt, nextNotifications) {
    const run = matchRuns.find((item) => item.id === runId);
    if (!run) return null;
    if (run.status !== "confirmed") {
      for (const other of matchRuns) {
        if (other.activityId === run.activityId && other.status === "confirmed") {
          other.status = "superseded";
        }
      }
      run.status = "confirmed";
      run.confirmedAt = confirmedAt;
      for (const item of nextNotifications) {
        if (!notifications.some((existing) => existing.dedupeKey === item.dedupeKey)) {
          notifications.push({ ...item });
        }
      }
    }
    return {
      ...run,
      assignments: assignments.filter((item) => item.matchRunId === run.id)
    };
  },
  async getConfirmedMatchForSignup(activityId, signupId) {
    const run = [...matchRuns].reverse().find(
      (item) => item.activityId === activityId && item.status === "confirmed"
    );
    if (!run) return null;
    return {
      ...run,
      assignments: assignments.filter(
        (item) => item.matchRunId === run.id
          && (item.riderSignupId === signupId || item.ownerSignupId === signupId)
      )
    };
  },
  async writeAudit(record) {
    auditLogs.push(record);
  },
  async getAcceptedSubscriptionForUser(userId) {
    return userId === "wechat-user-1"
      ? { userId, templateId: "match-template-1", status: "accept" }
      : null;
  },
  async getWechatRecipient(userId) {
    return userId === "wechat-user-1" ? { openid: "openid-rider-a" } : null;
  },
  async updateNotification(record) {
    const index = notifications.findIndex((item) => item.id === record.id);
    if (index >= 0) notifications[index] = { ...notifications[index], ...record };
    return notifications[index] || null;
  },
  prepare(sql) {
    const executeAll = (bindings = []) => {
      const activityId = bindings[0];
      return {
        results: rows
          .filter((row) => !activityId || row.activityId === activityId)
          .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      };
    };
    return {
      bind(...values) {
        return {
          async run() {
            if (sql.includes("INSERT INTO signups")) {
              const record = valuesToSignup(values);
              const index = rows.findIndex(
                (item) => item.activityId === record.activityId && item.phone === record.phone
              );
              if (index >= 0) rows[index] = { ...rows[index], ...record, id: rows[index].id };
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
  ADMIN_SESSION_SECRET: "test-secret-that-is-long-enough-123456",
  WECHAT_SUBSCRIBE_SENDER: async (message) => {
    sentMessages.push(message);
    return { messageId: "wechat-message-1" };
  }
};

async function call(path, init = {}) {
  return worker.fetch(new Request(`https://luyouclub.test${path}`, init), env, {});
}

async function signup(input) {
  const response = await call("/api/v1/activities/trip-1/signups", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      work: "海淀",
      home: "朝阳",
      depositConfirmed: true,
      contactConsent: true,
      notificationConsent: true,
      ...input
    })
  });
  assert.equal(response.status, 201);
  const result = await response.json();
  assert.ok(result.accessToken);
  return result;
}

const ownerA = await signup({
  name: "无烟车主",
  phone: "13900000001",
  wechat: "owner_a",
  role: "owner",
  vehicle: "SUV A",
  licensePlate: "京A10001",
  seats: 1,
  smoking: "不吸烟",
  acceptsSmoking: "不接受",
  interests: ["摄影"]
});
const ownerB = await signup({
  name: "吸烟车主",
  phone: "13900000002",
  wechat: "owner_b",
  role: "owner",
  vehicle: "SUV B",
  licensePlate: "京A10002",
  seats: 1,
  smoking: "吸烟",
  acceptsSmoking: "接受",
  interests: ["露营"]
});
const riderA = await signup({
  name: "无烟乘客",
  phone: "13900000003",
  wechat: "rider_a",
  role: "rider",
  smoking: "不吸烟",
  acceptsSmoking: "不接受",
  interests: ["摄影"]
});
rows.find((item) => item.id === riderA.id).userId = "wechat-user-1";
await signup({
  name: "吸烟乘客",
  phone: "13900000004",
  wechat: "rider_b",
  role: "rider",
  smoking: "吸烟",
  acceptsSmoking: "接受",
  interests: ["露营"]
});
await signup({
  name: "候补乘客",
  phone: "13900000005",
  wechat: "rider_c",
  role: "rider",
  smoking: "不吸烟",
  acceptsSmoking: "接受",
  interests: ["音乐"]
});

assert.equal(
  (await call("/api/v1/admin/activities/trip-1/matches/runs", { method: "POST" })).status,
  401
);

const login = await call("/api/admin/login", {
  method: "POST",
  redirect: "manual",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: "password=test-password"
});
const cookie = login.headers.get("set-cookie")?.split(";", 1)[0];
assert.ok(cookie);

const draftResponse = await call("/api/v1/admin/activities/trip-1/matches/runs", {
  method: "POST",
  headers: { cookie }
});
assert.equal(draftResponse.status, 201);
const firstDraft = await draftResponse.json();
assert.equal(firstDraft.status, "draft");
assert.equal(firstDraft.assignments.length, 3);
const matched = firstDraft.assignments.filter((item) => item.ownerSignupId);
assert.equal(matched.length, 2);
assert.equal(new Set(matched.map((item) => item.ownerSignupId)).size, 2);
assert.ok(matched.every((item) => item.score > 0 && item.reasons.length > 0));
assert.equal(
  firstDraft.assignments.find((item) => item.riderSignupId === riderA.id).ownerSignupId,
  ownerA.id
);

const pending = await call(`/api/v1/me/signups/${riderA.id}/match`, {
  headers: { authorization: `Bearer ${riderA.accessToken}` }
});
assert.equal(pending.status, 200);
assert.deepEqual(await pending.json(), { status: "pending" });

const riderAAssignment = firstDraft.assignments.find(
  (item) => item.riderSignupId === riderA.id
);
const lockedResponse = await call(
  `/api/v1/admin/matches/assignments/${riderAAssignment.id}`,
  {
    method: "PUT",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ ownerSignupId: ownerA.id, locked: true })
  }
);
assert.equal(lockedResponse.status, 200);
assert.equal((await lockedResponse.json()).locked, true);

const rerunResponse = await call("/api/v1/admin/activities/trip-1/matches/runs", {
  method: "POST",
  headers: { cookie }
});
const rerun = await rerunResponse.json();
const preserved = rerun.assignments.find((item) => item.riderSignupId === riderA.id);
assert.equal(preserved.ownerSignupId, ownerA.id);
assert.equal(preserved.locked, true);
assert.equal(preserved.source, "manual");

const confirmPath = `/api/v1/admin/matches/runs/${rerun.id}/confirm`;
const confirmedResponse = await call(confirmPath, { method: "POST", headers: { cookie } });
assert.equal(confirmedResponse.status, 200);
const confirmed = await confirmedResponse.json();
assert.equal(confirmed.status, "confirmed");
assert.match(confirmed.notificationText, /无烟乘客/);
assert.equal(notifications.length, 4);
assert.equal(sentMessages.length, 1);
assert.equal(sentMessages[0].openid, "openid-rider-a");
assert.equal(notifications.find((item) => item.signupId === riderA.id).status, "sent");
assert.equal(auditLogs.filter((item) => item.action === "matches.confirm").length, 1);

const visible = await call(`/api/v1/me/signups/${riderA.id}/match`, {
  headers: { authorization: `Bearer ${riderA.accessToken}` }
});
assert.equal(visible.status, 200);
const result = await visible.json();
assert.equal(result.status, "confirmed");
assert.equal(result.group.owner.name, "无烟车主");
assert.equal(result.group.owner.phone, "13900000001");
assert.equal(result.group.owner.wechat, "owner_a");

const forbidden = await call(`/api/v1/me/signups/${riderA.id}/match`, {
  headers: { authorization: `Bearer ${ownerB.accessToken}` }
});
assert.equal(forbidden.status, 403);

const notificationCount = notifications.length;
const repeated = await call(confirmPath, { method: "POST", headers: { cookie } });
assert.equal(repeated.status, 200);
assert.equal(notifications.length, notificationCount);
assert.equal(auditLogs.filter((item) => item.action === "matches.confirm").length, 1);

console.log("Stage 2 matching, confirmation, privacy and notification flow passed.");
