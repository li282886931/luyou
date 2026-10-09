import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const {
  SIGNUP_BIND_VALUE_COUNT,
  toCloudSignupRow,
  valuesToRecord
} = require(resolve(import.meta.dirname, "../cloudbase/data-contract.cjs"));

const values = [
  "signup-1",
  "2026-09-28T00:00:00Z",
  "2026-09-28T00:00:00Z",
  "activity-a",
  "user-a",
  "测试车主",
  "13900000001",
  "test_owner",
  "owner",
  "男",
  "31-35",
  "双子座",
  "海淀",
  "朝阳",
  "清河",
  "SUV",
  "京A12345",
  2,
  "无",
  "不吸烟",
  "不接受",
  "标间",
  '["轮胎"]',
  "",
  "待核验",
  '["摄影"]',
  "已报名",
  1,
  1
];

assert.equal(SIGNUP_BIND_VALUE_COUNT, 29);
assert.equal(values.length, SIGNUP_BIND_VALUE_COUNT);

const record = valuesToRecord(values);
assert.equal(record.id, "signup-1");
assert.equal(record._id, "signup-1");
assert.equal(record.activityId, "activity-a");
assert.equal(record.userId, "user-a");
assert.equal(record.licensePlate, "京A12345");

const cloudRow = toCloudSignupRow(record);
assert.equal(cloudRow.id, "signup-1");
assert.equal(cloudRow.activityId, "activity-a");
assert.equal(cloudRow.userId, "user-a");
assert.equal(cloudRow.phone, "13900000001");
assert.equal(cloudRow.wechat, "test_owner");
assert.equal(cloudRow.licensePlate, "京A12345");
assert.equal(cloudRow.modificationsJson, '["轮胎"]');
assert.equal(cloudRow.depositStatus, "待核验");
assert.equal(cloudRow.interestsJson, '["摄影"]');
assert.equal(cloudRow.signupStatus, "已报名");
assert.equal(cloudRow.contactConsent, true);
assert.equal(cloudRow.notificationConsent, true);
assert.equal(Object.hasOwn(cloudRow, "_id"), false);

console.log("CloudBase signup data contract passed.");
