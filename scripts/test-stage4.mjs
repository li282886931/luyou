import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const worker = require(resolve(import.meta.dirname, "../release/luyouclub-cloudbase/worker.cjs"));
const rows = [];
const users = [];
const sessions = [];
const grants = [];
const notifications = [];

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
  async upsertWechatUser(identity) {
    let user = users.find((item) => item.openid === identity.openid);
    if (!user) {
      user = { ...identity, id: "user-1" };
      users.push(user);
    }
    return user;
  },
  async createUserSession(session) {
    sessions.push(session);
  },
  async findUserBySession(tokenHash, now) {
    const session = sessions.find((item) =>
      item.tokenHash === tokenHash && item.expiresAt > now
    );
    return session ? users.find((item) => item.id === session.userId) || null : null;
  },
  async listSignupsByUser(userId) {
    return rows.filter((item) => item.userId === userId);
  },
  async findSignupByActivityPhone(activityId, phone) {
    return rows.find((item) => item.activityId === activityId && item.phone === phone) || null;
  },
  async bindUserPhone(userId, phone) {
    const user = users.find((item) => item.id === userId);
    user.phone = phone;
    for (const row of rows) {
      if (row.phone === phone && !row.userId) row.userId = userId;
    }
    return {
      user,
      boundSignups: rows.filter((item) => item.userId === userId).length
    };
  },
  async saveSubscriptionGrant(grant) {
    grants.push(grant);
    return grant;
  },
  async listSubscriptionGrants(userId) {
    return grants.filter((item) => item.userId === userId);
  },
  async listNotificationsByUser(userId) {
    const signupIds = new Set(rows.filter((item) => item.userId === userId).map((item) => item.id));
    return notifications.filter((item) => signupIds.has(item.signupId));
  },
  async getConfirmedMatchForSignup() {
    return null;
  },
  prepare(sql) {
    const selectRows = async (values = []) => {
      const activityId = /WHERE activity_id = \?/i.test(sql) ? values[0] : "";
      return {
        results: rows.filter((item) => !activityId || item.activityId === activityId)
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
            return selectRows(values);
          }
        };
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
  WECHAT_CODE_EXCHANGE: async (code) => {
    assert.equal(code, "valid-login-code");
    return { openid: "openid-1", unionid: "unionid-1" };
  },
  WECHAT_PHONE_EXCHANGE: async (code) => {
    assert.equal(code, "valid-phone-code");
    return { phoneNumber: "13800000008" };
  }
};

async function call(path, init = {}) {
  return worker.fetch(new Request(`https://luyouclub.test${path}`, init), env, {});
}

const login = await call("/api/v1/auth/wechat", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ code: "valid-login-code" })
});
assert.equal(login.status, 200);
const auth = await login.json();
assert.ok(auth.token);
assert.equal(auth.user.id, "user-1");

const authorization = `Bearer ${auth.token}`;
rows.push({
  id: "existing-signup",
  activityId: "existing-activity",
  userId: "",
  name: "既有报名",
  phone: "13800000008",
  role: "rider",
  work: "西城",
  home: "东城",
  status: "待匹配",
  signupStatus: "已报名",
  createdAt: "2026-09-27T00:00:00.000Z",
  updatedAt: "2026-09-27T00:00:00.000Z",
  interestsJson: "[]",
  modificationsJson: "[]"
});
const phoneBinding = await call("/api/v1/me/phone", {
  method: "POST",
  headers: { authorization, "content-type": "application/json" },
  body: JSON.stringify({ code: "valid-phone-code" })
});
assert.equal(phoneBinding.status, 200);
assert.equal((await phoneBinding.json()).boundSignups, 1);
assert.equal(rows[0].userId, "user-1");

const emptySignups = await call("/api/v1/me/signups", {
  headers: { authorization }
});
assert.equal(emptySignups.status, 200);
assert.equal((await emptySignups.json()).length, 1);

const signup = await call("/api/v1/activities/activity-stage4/signups", {
  method: "POST",
  headers: { authorization, "content-type": "application/json" },
  body: JSON.stringify({
    userId: "attacker-controlled-id",
    name: "微信报名用户",
    phone: "13900000009",
    wechat: "wechat_member",
    role: "rider",
    work: "海淀",
    home: "朝阳",
    depositConfirmed: true,
    contactConsent: true,
    notificationConsent: true
  })
});
assert.equal(signup.status, 201);
const signupResult = await signup.json();
assert.equal(rows[1].userId, "user-1");
assert.notEqual(rows[1].userId, "attacker-controlled-id");
const repeatedSignup = await call("/api/v1/activities/activity-stage4/signups", {
  method: "POST",
  headers: { authorization, "content-type": "application/json" },
  body: JSON.stringify({
    name: "微信报名用户更新",
    phone: "13900000009",
    wechat: "wechat_member",
    role: "rider",
    work: "海淀",
    home: "朝阳",
    depositConfirmed: true
  })
});
assert.equal((await repeatedSignup.json()).id, signupResult.id);
assert.equal(rows.length, 2);

const mySignups = await call("/api/v1/me/signups", {
  headers: { authorization }
});
assert.equal(mySignups.status, 200);
const signupList = await mySignups.json();
assert.equal(signupList.length, 2);
assert.equal(signupList[1].activityId, "activity-stage4");
assert.equal(signupList[1].phone, undefined);
assert.deepEqual(signupList[1].interests, []);

const grantResponse = await call("/api/v1/me/subscriptions", {
  method: "POST",
  headers: { authorization, "content-type": "application/json" },
  body: JSON.stringify({
    templateId: "match-confirmed-v1",
    status: "accept"
  })
});
assert.equal(grantResponse.status, 201);
assert.equal(grants[0].userId, "user-1");
assert.equal(grants[0].templateId, "match-confirmed-v1");

const grantList = await call("/api/v1/me/subscriptions", {
  headers: { authorization }
});
assert.equal(grantList.status, 200);
assert.equal((await grantList.json())[0].status, "accept");

notifications.push({
  id: "notification-1",
  signupId: signupResult.id,
  type: "match_confirmed",
  channel: "wechat_subscribe",
  status: "sent",
  sentAt: "2026-09-28T00:00:00.000Z"
});
const notificationList = await call("/api/v1/me/notifications", {
  headers: { authorization }
});
assert.equal(notificationList.status, 200);
assert.equal((await notificationList.json())[0].status, "sent");

assert.equal((await call("/api/v1/me/signups")).status, 401);
assert.equal((await call(`/api/v1/me/signups/${signupResult.id}/match`, {
  headers: { authorization: "Bearer invalid-token" }
})).status, 403);

console.log("Stage 4 WeChat identity, user-bound signups and subscription status passed.");
