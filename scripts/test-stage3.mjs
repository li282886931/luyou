import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const worker = require(resolve(import.meta.dirname, "../release/luyouclub-cloudbase/worker.cjs"));
const activities = [];
const posts = [];
const mediaAssets = [];
const publishedSnapshots = [];

const DB = {
  async listPublicActivities() {
    return activities
      .filter((item) => item.status === "published")
      .map((item) => publishedSnapshots.find((snapshot) =>
        snapshot.activityId === item.id && snapshot.version === item.publishedVersion
      )?.content)
      .filter(Boolean);
  },
  async getPublicActivity(id) {
    return (await this.listPublicActivities()).find((item) => item.id === id) || null;
  },
  async listAdminActivities() {
    return activities.map((item) => ({ ...item }));
  },
  async getAdminActivity(id) {
    return activities.find((item) => item.id === id) || null;
  },
  async saveActivityDraft(record) {
    const index = activities.findIndex((item) => item.id === record.id);
    if (index >= 0) activities[index] = { ...activities[index], ...record };
    else activities.push({ ...record });
    return activities.find((item) => item.id === record.id);
  },
  async publishActivity(id, publishedAt) {
    const activity = activities.find((item) => item.id === id);
    if (!activity) return null;
    activity.status = "published";
    activity.publishedVersion = Number(activity.publishedVersion || 0) + 1;
    activity.publishedAt = publishedAt;
    activity.updatedAt = publishedAt;
    const content = JSON.parse(JSON.stringify(activity));
    publishedSnapshots.push({
      activityId: id,
      version: activity.publishedVersion,
      content
    });
    return content;
  },
  async unpublishActivity(id) {
    const activity = activities.find((item) => item.id === id);
    if (!activity) return null;
    activity.status = "closed";
    return { ...activity };
  },
  async savePostDraft(record) {
    const index = posts.findIndex((item) => item.id === record.id);
    if (index >= 0) posts[index] = { ...posts[index], ...record };
    else posts.push({ ...record });
    return posts.find((item) => item.id === record.id);
  },
  async publishPost(id, publishedAt) {
    const draft = posts.find((item) => item.id === id);
    if (!draft) return null;
    const version = Math.max(
      0,
      ...posts
        .filter((item) => item.activityId === draft.activityId && item.type === draft.type)
        .map((item) => Number(item.version) || 0)
    ) + 1;
    const published = {
      ...JSON.parse(JSON.stringify(draft)),
      id: `${draft.activityId}-${draft.type}-v${version}`,
      status: "published",
      version,
      publishedAt,
      updatedAt: publishedAt
    };
    posts.push(published);
    return published;
  },
  async listPublicPosts(activityId, type) {
    return posts.filter((item) =>
      item.activityId === activityId
      && item.status === "published"
      && (!type || item.type === type)
    );
  },
  async uploadMedia(name, contentType, bytes) {
    return {
      fileId: `club-media/${name}`,
      name,
      type: contentType,
      size: bytes.byteLength
    };
  },
  async createMediaAsset(record) {
    mediaAssets.push({ ...record });
    return record;
  },
  async resolveMedia(items) {
    return items.map((item) => ({ ...item, url: `https://signed.test/${item.fileId}` }));
  },
  async writeAudit() {}
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

const login = await call("/api/admin/login", {
  method: "POST",
  redirect: "manual",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: "password=test-password"
});
const cookie = login.headers.get("set-cookie")?.split(";", 1)[0];
assert.ok(cookie);

env.TEST_MODE = "false";
assert.equal(
  (await call("/api/v1/admin/activities/csrf-attempt", {
    method: "PUT",
    headers: {
      cookie,
      origin: "https://attacker.example",
      "content-type": "application/json"
    },
    body: JSON.stringify({ title: "CSRF", dateText: "today", route: "bad" })
  })).status,
  403
);
env.TEST_MODE = "true";

assert.equal(
  (await call("/api/v1/admin/activities", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "越权活动" })
  })).status,
  401
);

const createdResponse = await call("/api/v1/admin/activities", {
  method: "POST",
  headers: { cookie, "content-type": "application/json" },
  body: JSON.stringify({
    id: "trip-publish",
    title: "草原初稿",
    dateText: "10.01-10.03",
    route: "北京 -> 张北",
    timeline: ["集合", "出发"],
    notice: "带好证件",
    capacity: 20,
    signupOpen: true
  })
});
assert.equal(createdResponse.status, 201);
assert.equal((await call("/api/v1/activities")).status, 200);
assert.deepEqual(await (await call("/api/v1/activities")).json(), []);

const publishV1 = await call("/api/v1/admin/activities/trip-publish/publish", {
  method: "POST",
  headers: { cookie }
});
assert.equal(publishV1.status, 200);
assert.equal((await publishV1.json()).publishedVersion, 1);
assert.equal((await (await call("/api/v1/activities/trip-publish")).json()).title, "草原初稿");

const update = await call("/api/v1/admin/activities/trip-publish", {
  method: "PUT",
  headers: { cookie, "content-type": "application/json" },
  body: JSON.stringify({ title: "草原正式版", notice: "带好证件和外套" })
});
assert.equal(update.status, 200);
assert.equal((await (await call("/api/v1/activities/trip-publish")).json()).title, "草原初稿");

const publishV2 = await call("/api/v1/admin/activities/trip-publish/publish", {
  method: "POST",
  headers: { cookie }
});
assert.equal((await publishV2.json()).publishedVersion, 2);
assert.equal((await (await call("/api/v1/activities/trip-publish")).json()).title, "草原正式版");
assert.equal(publishedSnapshots[0].content.title, "草原初稿");

const recapDraft = await call("/api/v1/admin/posts", {
  method: "POST",
  headers: { cookie, "content-type": "application/json" },
  body: JSON.stringify({
    id: "recap-draft",
    activityId: "trip-publish",
    type: "recap",
    title: "草原回顾",
    content: { blocks: [{ type: "paragraph", text: "同行故事" }] }
  })
});
assert.equal(recapDraft.status, 201);
assert.deepEqual(await (await call("/api/v1/activities/trip-publish/posts?type=recap")).json(), []);

const recapPublish = await call("/api/v1/admin/posts/recap-draft/publish", {
  method: "POST",
  headers: { cookie }
});
assert.equal(recapPublish.status, 200);
const publicPosts = await (await call("/api/v1/activities/trip-publish/posts?type=recap")).json();
assert.equal(publicPosts.length, 1);
assert.equal(publicPosts[0].title, "草原回顾");
assert.equal(publicPosts[0].version, 1);

const mediaForm = new FormData();
mediaForm.set("activityId", "trip-publish");
mediaForm.set("file", new File(["real-image-bytes"], "cover.jpg", { type: "image/jpeg" }));
const uploaded = await call("/api/v1/admin/media", {
  method: "POST",
  headers: { cookie },
  body: mediaForm
});
assert.equal(uploaded.status, 200);
const media = await uploaded.json();
assert.ok(media.media.id);
assert.equal(mediaAssets.length, 1);
assert.equal(mediaAssets[0].activityId, "trip-publish");
assert.equal(mediaAssets[0].status, "uploaded");

const unpublish = await call("/api/v1/admin/activities/trip-publish/unpublish", {
  method: "POST",
  headers: { cookie }
});
assert.equal(unpublish.status, 200);
assert.equal((await call("/api/v1/activities/trip-publish")).status, 404);

console.log("Stage 3 draft, versioned publishing, posts and media persistence passed.");
