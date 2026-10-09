const http = require("node:http");
const { readFile, writeFile } = require("node:fs/promises");
const { existsSync } = require("node:fs");
const { webcrypto } = require("node:crypto");
const path = require("node:path");
const { toCloudSignupRow, valuesToRecord } = require("./data-contract.cjs");

globalThis.crypto ||= webcrypto;
const worker = require("./worker.cjs");
const PORT = Number(process.env.PORT || 9000);
const LOCAL_DB_PATH = process.env.LOCAL_DB_PATH || path.join("/tmp", "luyouclub-signups.json");
const LOCAL_MATCH_PATH = process.env.LOCAL_MATCH_PATH || path.join("/tmp", "luyouclub-matches.json");
let localContent = null;
let localActivities = [];

async function localRows() {
  if (!existsSync(LOCAL_DB_PATH)) return [];
  try { return JSON.parse(await readFile(LOCAL_DB_PATH, "utf8")); } catch { return []; }
}

function emptyLocalState() {
  return {
    capabilities: [],
    matchRuns: [],
    assignments: [],
    notifications: [],
    auditLogs: [],
    activities: [],
    activityVersions: [],
    posts: [],
    mediaAssets: [],
    users: [],
    wechatIdentities: [],
    userSessions: [],
    subscriptionGrants: [],
    signupLocations: [],
    signupOperations: [],
    contentGenerations: []
  };
}

async function localMatchState() {
  if (!existsSync(LOCAL_MATCH_PATH)) return emptyLocalState();
  try {
    return {
      ...emptyLocalState(),
      ...JSON.parse(await readFile(LOCAL_MATCH_PATH, "utf8"))
    };
  } catch {
    return emptyLocalState();
  }
}

async function saveLocalMatchState(state) {
  await writeFile(LOCAL_MATCH_PATH, JSON.stringify(state, null, 2));
}

function localDatabase() {
  return {
    async getContent() { return localContent; },
    async saveContent(record) { localContent = { ...(localContent || {}), ...record }; return localContent; },
    async getActivities() { return localActivities; },
    async saveActivity(record) { const key = item => [item.title, item.nextTitle, item.dateText, item.route].join("|"); localActivities = [record, ...localActivities.filter(item => item.id !== record.id && key(item) !== key(record))].slice(0, 50); return record; },
    async listPublicActivities() {
      const state = await localMatchState();
      return state.activities.filter(item => item.status === "published").map(item => state.activityVersions.find(version => version.activityId === item.id && version.version === item.publishedVersion)?.content).filter(Boolean);
    },
    async getPublicActivity(id) {
      return (await this.listPublicActivities()).find(item => item.id === id) || null;
    },
    async listAdminActivities() {
      return (await localMatchState()).activities;
    },
    async getAdminActivity(id) {
      return (await localMatchState()).activities.find(item => item.id === id) || null;
    },
    async saveActivityDraft(record) {
      const state = await localMatchState();
      const index = state.activities.findIndex(item => item.id === record.id);
      if (index >= 0) state.activities[index] = { ...state.activities[index], ...record };
      else state.activities.push(record);
      await saveLocalMatchState(state);
      return state.activities.find(item => item.id === record.id);
    },
    async publishActivity(id, publishedAt) {
      const state = await localMatchState();
      const activity = state.activities.find(item => item.id === id);
      if (!activity) return null;
      activity.status = "published";
      activity.publishedVersion = Number(activity.publishedVersion || 0) + 1;
      activity.publishedAt = publishedAt;
      activity.updatedAt = publishedAt;
      state.activityVersions.push({ activityId: id, version: activity.publishedVersion, content: structuredClone(activity) });
      await saveLocalMatchState(state);
      return activity;
    },
    async unpublishActivity(id) {
      const state = await localMatchState();
      const activity = state.activities.find(item => item.id === id);
      if (!activity) return null;
      activity.status = "closed";
      activity.updatedAt = new Date().toISOString();
      await saveLocalMatchState(state);
      return activity;
    },
    async savePostDraft(record) {
      const state = await localMatchState();
      const index = state.posts.findIndex(item => item.id === record.id);
      if (index >= 0) state.posts[index] = { ...state.posts[index], ...record };
      else state.posts.push(record);
      await saveLocalMatchState(state);
      return state.posts.find(item => item.id === record.id);
    },
    async publishPost(id, publishedAt) {
      const state = await localMatchState();
      const draft = state.posts.find(item => item.id === id);
      if (!draft) return null;
      const version = Math.max(0, ...state.posts.filter(item => item.activityId === draft.activityId && item.type === draft.type).map(item => Number(item.version) || 0)) + 1;
      const published = { ...structuredClone(draft), id: `${draft.activityId}-${draft.type}-v${version}-${Date.now().toString(36)}`, status: "published", version, publishedAt, updatedAt: publishedAt };
      state.posts.push(published);
      await saveLocalMatchState(state);
      return published;
    },
    async listPublicPosts(activityId, type) {
      const state = await localMatchState();
      return state.posts.filter(item => item.activityId === activityId && item.status === "published" && (!type || item.type === type));
    },
    async createMediaAsset(record) {
      const state = await localMatchState();
      state.mediaAssets.push(record);
      await saveLocalMatchState(state);
      return record;
    },
    async saveContentGeneration(record) {
      const state = await localMatchState();
      state.contentGenerations.push(record);
      await saveLocalMatchState(state);
      return record;
    },
    async writeAudit(record) {
      const state = await localMatchState();
      state.auditLogs.push(record);
      await saveLocalMatchState(state);
    },
    async upsertWechatUser(identity) {
      const state = await localMatchState();
      const existingIdentity = state.wechatIdentities.find(item => item.openid === identity.openid);
      if (existingIdentity) {
        return state.users.find(item => item.id === existingIdentity.userId) || null;
      }
      const user = {
        id: identity.id,
        phone: "",
        createdAt: identity.createdAt,
        updatedAt: identity.updatedAt
      };
      state.users.push(user);
      state.wechatIdentities.push({
        id: identity.identityId,
        userId: user.id,
        openid: identity.openid,
        unionid: identity.unionid || "",
        createdAt: identity.createdAt,
        updatedAt: identity.updatedAt
      });
      await saveLocalMatchState(state);
      return user;
    },
    async createUserSession(record) {
      const state = await localMatchState();
      state.userSessions.push(record);
      await saveLocalMatchState(state);
    },
    async findUserBySession(tokenHash, now) {
      const state = await localMatchState();
      const session = state.userSessions.find(item => item.tokenHash === tokenHash && item.expiresAt > now);
      return session ? state.users.find(item => item.id === session.userId) || null : null;
    },
    async listSignupsByUser(userId) {
      return (await localRows()).filter(item => item.userId === userId);
    },
    async findSignupByActivityPhone(activityId, phone) {
      return (await localRows()).find(item => item.activityId === activityId && item.phone === phone) || null;
    },
    async saveSignupLocation(record) {
      const state = await localMatchState();
      const index = state.signupLocations.findIndex(item => item.signupId === record.signupId);
      if (index >= 0) state.signupLocations[index] = record;
      else state.signupLocations.push(record);
      await saveLocalMatchState(state);
      return record;
    },
    async attachSignupLocations(rows) {
      const locations = new Map((await localMatchState()).signupLocations.map(item => [item.signupId, item]));
      return rows.map(item => ({ ...item, ...(locations.get(item.id) || {}) }));
    },
    async updateSignupLifecycle(signupId, changes, operation) {
      const rows = await localRows();
      const row = rows.find(item => item.id === signupId);
      if (!row) return null;
      Object.assign(row, changes);
      const state = await localMatchState();
      state.signupOperations.push(operation);
      await Promise.all([
        writeFile(LOCAL_DB_PATH, JSON.stringify(rows, null, 2)),
        saveLocalMatchState(state)
      ]);
      return row;
    },
    async listSignupOperations(activityId) {
      return (await localMatchState()).signupOperations.filter(item => item.activityId === activityId);
    },
    async bindUserPhone(userId, phone, updatedAt) {
      const state = await localMatchState();
      const user = state.users.find(item => item.id === userId);
      if (!user) return null;
      user.phone = phone;
      user.updatedAt = updatedAt;
      const rows = await localRows();
      let boundSignups = 0;
      for (const row of rows) {
        if (row.phone === phone && (!row.userId || row.userId === userId)) {
          row.userId = userId;
          row.updatedAt = updatedAt;
          boundSignups += 1;
        }
      }
      await Promise.all([
        saveLocalMatchState(state),
        writeFile(LOCAL_DB_PATH, JSON.stringify(rows, null, 2))
      ]);
      return { user, boundSignups };
    },
    async saveSubscriptionGrant(record) {
      const state = await localMatchState();
      const index = state.subscriptionGrants.findIndex(item => item.userId === record.userId && item.templateId === record.templateId);
      if (index >= 0) state.subscriptionGrants[index] = { ...state.subscriptionGrants[index], ...record, id: state.subscriptionGrants[index].id };
      else state.subscriptionGrants.push(record);
      await saveLocalMatchState(state);
      return state.subscriptionGrants.find(item => item.userId === record.userId && item.templateId === record.templateId);
    },
    async listSubscriptionGrants(userId) {
      return (await localMatchState()).subscriptionGrants.filter(item => item.userId === userId);
    },
    async getAcceptedSubscriptionForUser(userId) {
      return [...(await localMatchState()).subscriptionGrants].reverse().find(item => item.userId === userId && item.status === "accept") || null;
    },
    async getWechatRecipient(userId) {
      const identity = (await localMatchState()).wechatIdentities.find(item => item.userId === userId);
      return identity ? { openid: identity.openid } : null;
    },
    async listNotificationsByUser(userId) {
      const signupIds = new Set((await localRows()).filter(item => item.userId === userId).map(item => item.id));
      return (await localMatchState()).notifications.filter(item => signupIds.has(item.signupId));
    },
    async updateNotification(record) {
      const state = await localMatchState();
      const index = state.notifications.findIndex(item => item.id === record.id);
      if (index < 0) return null;
      state.notifications[index] = { ...state.notifications[index], ...record };
      await saveLocalMatchState(state);
      return state.notifications[index];
    },
    async saveSignupCapability(record) {
      const state = await localMatchState();
      state.capabilities = [record, ...state.capabilities.filter(item => item.activityId !== record.activityId || item.signupId !== record.signupId)];
      await saveLocalMatchState(state);
    },
    async findSignupByCapability(signupId, tokenHash) {
      const state = await localMatchState();
      const capability = state.capabilities.find(item => item.signupId === signupId && item.tokenHash === tokenHash);
      return capability ? (await localRows()).find(item => item.id === signupId) || null : null;
    },
    async saveMatchRun(run, assignments) {
      const state = await localMatchState();
      state.matchRuns.push(run);
      state.assignments.push(...assignments);
      await saveLocalMatchState(state);
      return { ...run, assignments };
    },
    async getLatestMatchRun(activityId) {
      const state = await localMatchState();
      const run = [...state.matchRuns].reverse().find(item => item.activityId === activityId);
      return run ? { ...run, assignments: state.assignments.filter(item => item.matchRunId === run.id) } : null;
    },
    async getMatchRun(runId) {
      const state = await localMatchState();
      const run = state.matchRuns.find(item => item.id === runId);
      return run ? { ...run, assignments: state.assignments.filter(item => item.matchRunId === run.id) } : null;
    },
    async getMatchRunByAssignment(assignmentId) {
      const state = await localMatchState();
      const assignment = state.assignments.find(item => item.id === assignmentId);
      if (!assignment) return null;
      const run = state.matchRuns.find(item => item.id === assignment.matchRunId);
      return run ? { ...run, assignments: state.assignments.filter(item => item.matchRunId === run.id) } : null;
    },
    async updateMatchAssignment(record) {
      const state = await localMatchState();
      const index = state.assignments.findIndex(item => item.id === record.id);
      if (index < 0) return null;
      state.assignments[index] = { ...state.assignments[index], ...record };
      await saveLocalMatchState(state);
      return state.assignments[index];
    },
    async confirmMatchRun(runId, confirmedAt, notifications) {
      const state = await localMatchState();
      const run = state.matchRuns.find(item => item.id === runId);
      if (!run) return null;
      if (run.status !== "confirmed") {
        for (const item of state.matchRuns) {
          if (item.activityId === run.activityId && item.status === "confirmed") item.status = "superseded";
        }
        run.status = "confirmed";
        run.confirmedAt = confirmedAt;
        for (const notification of notifications) {
          if (!state.notifications.some(item => item.dedupeKey === notification.dedupeKey)) state.notifications.push(notification);
        }
        await saveLocalMatchState(state);
      }
      return { ...run, assignments: state.assignments.filter(item => item.matchRunId === run.id) };
    },
    async getConfirmedMatchForSignup(activityId, signupId) {
      const state = await localMatchState();
      const run = [...state.matchRuns].reverse().find(item => item.activityId === activityId && item.status === "confirmed");
      if (!run) return null;
      return {
        ...run,
        assignments: state.assignments.filter(item => item.matchRunId === run.id && (item.ownerSignupId === signupId || item.riderSignupId === signupId))
      };
    },
    async uploadMedia(name, contentType, bytes) { return { fileId: `local://${Date.now()}-${name}`, name, type: contentType, url: `data:${contentType};base64,${Buffer.from(bytes).toString("base64")}` }; },
    async resolveMedia(items) { return items || []; },
    async assignRider(riderId, ownerId) { const rows = await localRows(); const row = rows.find(item => item.id === riderId); if (row) { row.assignedOwnerId = ownerId; row.status = ownerId ? "已匹配" : "待匹配"; await writeFile(LOCAL_DB_PATH, JSON.stringify(rows, null, 2)); } },
    prepare(sql) {
      const selectRows = async (values = []) => {
        const activityId = /WHERE activity_id = \?/i.test(sql) ? values[0] : "";
        const rows = (await localRows())
          .filter(item => !activityId || item.activityId === activityId)
          .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
        return { results: rows.slice(0, 1000) };
      };
      return {
        bind(...values) {
          return {
            async run() {
              if (!/INSERT INTO signups/i.test(sql)) return { success: true };
              const rows = await localRows();
              const record = valuesToRecord(values);
              const index = rows.findIndex(item => item.activityId === record.activityId && item.phone === record.phone);
              if (index >= 0) rows[index] = { ...rows[index], ...record, _id: rows[index]._id, id: rows[index].id };
              else rows.push(record);
              await writeFile(LOCAL_DB_PATH, JSON.stringify(rows, null, 2));
              return { success: true };
            },
            async all() { return selectRows(values); }
          };
        },
        async all() { return selectRows(); }
      };
    }
  };
}

function cloudDatabase() {
  const cloudbase = require("@cloudbase/js-sdk");
  const options = { env: process.env.CLOUDBASE_ENV_ID };
  if (process.env.CLOUDBASE_APIKEY) options.accessKey = process.env.CLOUDBASE_APIKEY;
  const app = cloudbase.init(options);
  const database = app.rdb();
  const storage = app.storage.from("club-media");
  async function cloudMatchRun(run) {
    if (!run) return null;
    const { data, error } = await database.from("matchAssignments").select("*").eq("matchRunId", run.id).limit(1000);
    if (error) throw new Error(error.message || "匹配明细读取失败");
    return { ...run, assignments: data || [] };
  }
  return {
    async uploadMedia(name, contentType, bytes) {
      const extension = String(name).split(".").pop().replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || (contentType.startsWith("video/") ? "mp4" : "jpg");
      const cloudPath = `club-media/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${extension}`;
      let result = await storage.upload(cloudPath, bytes, { contentType, upsert: false });
      if (result.error && /BUCKET_NOT_FOUND|Bucket not found/i.test(`${result.error.code || ""} ${result.error.message || ""}`)) {
        const created = await app.storage.createBucket("club-media", { public: false, type: "STANDARD", fileSizeLimit: 30 * 1024 * 1024 });
        if (created.error && created.error.code !== "STORAGE_BUCKET_ALREADY_EXISTS") throw new Error(created.error.message || "媒体空间创建失败");
        result = await storage.upload(cloudPath, bytes, { contentType, upsert: false });
      }
      if (result.error) throw new Error(result.error.message || "云存储上传失败");
      return { fileId: result.data.path || result.data.id, name, type: contentType };
    },
    async resolveMedia(items) {
      const list = (items || []).filter(item => item?.fileId);
      if (!list.length) return items || [];
      const resolved = await Promise.all(list.map(async item => {
        const { data, error } = await storage.createSignedUrl(item.fileId, 3600);
        return [item.fileId, error ? "" : (data?.fullSignedURL || data?.signedUrl || data?.url || (typeof data === "string" ? data : ""))];
      }));
      const urls = new Map(resolved);
      return (items || []).map(item => ({ ...item, url: urls.get(item.fileId) || item.url || "" }));
    },
    async getContent() {
      const { data, error } = await database.from("clubContent").select("*").eq("id", "main").limit(1);
      if (error) throw new Error(error.message || "活动内容读取失败");
      return data?.[0] || null;
    },
    async saveContent(record) {
      const { data, error } = await database.from("clubContent").upsert(record, { onConflict: "id" }).select();
      if (error) throw new Error(error.message || "活动内容保存失败");
      return data?.[0] || record;
    },
    async getActivities() {
      const { data, error } = await storage.download("activity-feed.json");
      if (error) return [];
      try {
        const bytes = Buffer.isBuffer(data) ? data : Buffer.from(typeof data?.arrayBuffer === "function" ? await data.arrayBuffer() : data);
        const parsed = JSON.parse(bytes.toString("utf8"));
        return Array.isArray(parsed) ? parsed : [];
      } catch { return []; }
    },
    async saveActivity(record) {
      const activities = await this.getActivities();
      const sameActivity = item => [item.title, item.nextTitle, item.dateText, item.route].join("|") === [record.title, record.nextTitle, record.dateText, record.route].join("|");
      const next = [record, ...activities.filter(item => item.id !== record.id && !sameActivity(item))].slice(0, 50);
      const result = await storage.upload("activity-feed.json", Buffer.from(JSON.stringify(next)), { contentType: "application/json", upsert: true });
      if (result.error) throw new Error(result.error.message || "活动列表保存失败");
      return record;
    },
    async listPublicActivities() {
      const { data: activities, error } = await database.from("activities").select("*").eq("status", "published").order("publishedAt", { ascending: false }).limit(100);
      if (error) throw new Error(error.message || "公开活动读取失败");
      const output = [];
      for (const activity of activities || []) {
        const { data: versions, error: versionError } = await database.from("posts").select("*").eq("activityId", activity.id).eq("type", "recruitment").eq("status", "published").eq("version", activity.publishedVersion).limit(1);
        if (versionError) throw new Error(versionError.message || "活动发布版本读取失败");
        if (versions?.[0]) output.push(JSON.parse(versions[0].contentJson || "{}"));
      }
      return output;
    },
    async getPublicActivity(id) {
      return (await this.listPublicActivities()).find(item => item.id === id) || null;
    },
    async listAdminActivities() {
      const { data, error } = await database.from("activities").select("*").order("updatedAt", { ascending: false }).limit(100);
      if (error) throw new Error(error.message || "后台活动读取失败");
      return data || [];
    },
    async getAdminActivity(id) {
      const { data, error } = await database.from("activities").select("*").eq("id", id).limit(1);
      if (error) throw new Error(error.message || "活动草稿读取失败");
      return data?.[0] || null;
    },
    async saveActivityDraft(record) {
      const { data, error } = await database.from("activities").upsert(record, { onConflict: "id" }).select();
      if (error) throw new Error(error.message || "活动草稿保存失败");
      return data?.[0] || record;
    },
    async publishActivity(id, publishedAt) {
      const activity = await this.getAdminActivity(id);
      if (!activity) return null;
      const publishedVersion = Number(activity.publishedVersion || 0) + 1;
      const published = { ...activity, status: "published", publishedVersion, publishedAt, updatedAt: publishedAt };
      const version = {
        id: `${id}-recruitment-v${publishedVersion}-${Date.now().toString(36)}`,
        activityId: id,
        type: "recruitment",
        title: published.title,
        contentJson: JSON.stringify(published),
        status: "published",
        version: publishedVersion,
        createdAt: publishedAt,
        updatedAt: publishedAt,
        publishedAt
      };
      const { error: versionError } = await database.from("posts").insert(version);
      if (versionError) throw new Error(versionError.message || "活动版本保存失败");
      const { data, error } = await database.from("activities").upsert(published, { onConflict: "id" }).select();
      if (error) throw new Error(error.message || "活动发布失败");
      return data?.[0] || published;
    },
    async unpublishActivity(id) {
      const activity = await this.getAdminActivity(id);
      if (!activity) return null;
      const record = { ...activity, status: "closed", updatedAt: new Date().toISOString() };
      const { data, error } = await database.from("activities").upsert(record, { onConflict: "id" }).select();
      if (error) throw new Error(error.message || "活动下线失败");
      return data?.[0] || record;
    },
    async savePostDraft(record) {
      const { data, error } = await database.from("posts").upsert(record, { onConflict: "id" }).select();
      if (error) throw new Error(error.message || "内容草稿保存失败");
      return data?.[0] || record;
    },
    async publishPost(id, publishedAt) {
      const { data: drafts, error: draftError } = await database.from("posts").select("*").eq("id", id).limit(1);
      if (draftError) throw new Error(draftError.message || "内容草稿读取失败");
      const draft = drafts?.[0];
      if (!draft) return null;
      const { data: versions, error: versionError } = await database.from("posts").select("version").eq("activityId", draft.activityId).eq("type", draft.type).eq("status", "published").order("version", { ascending: false }).limit(1);
      if (versionError) throw new Error(versionError.message || "内容版本读取失败");
      const version = Number(versions?.[0]?.version || 0) + 1;
      const published = { ...draft, id: `${draft.activityId}-${draft.type}-v${version}-${Date.now().toString(36)}`, status: "published", version, publishedAt, updatedAt: publishedAt };
      const { data, error } = await database.from("posts").insert(published).select();
      if (error) throw new Error(error.message || "内容发布失败");
      return data?.[0] || published;
    },
    async listPublicPosts(activityId, type) {
      let query = database.from("posts").select("*").eq("activityId", activityId).eq("status", "published");
      if (type) query = query.eq("type", type);
      const { data, error } = await query.order("publishedAt", { ascending: false }).limit(100);
      if (error) throw new Error(error.message || "公开内容读取失败");
      return data || [];
    },
    async createMediaAsset(record) {
      const { data, error } = await database.from("mediaAssets").insert(record).select();
      if (error) throw new Error(error.message || "媒体元数据保存失败");
      return data?.[0] || record;
    },
    async saveContentGeneration(record) {
      const { data, error } = await database.from("contentGenerations").insert(record).select();
      if (error) throw new Error(error.message || "排版方案保存失败");
      return data?.[0] || record;
    },
    async writeAudit(record) {
      const { error } = await database.from("auditLogs").insert(record);
      if (error) throw new Error(error.message || "审计日志写入失败");
    },
    async upsertWechatUser(identity) {
      const { data: identities, error: identityError } = await database.from("wechatIdentities").select("*").eq("openid", identity.openid).limit(1);
      if (identityError) throw new Error(identityError.message || "微信身份读取失败");
      if (identities?.[0]) {
        const { data: existingUsers, error: userError } = await database.from("users").select("*").eq("id", identities[0].userId).limit(1);
        if (userError) throw new Error(userError.message || "用户读取失败");
        if (existingUsers?.[0]) return existingUsers[0];
      }
      const user = {
        id: identity.id,
        phone: "",
        createdAt: identity.createdAt,
        updatedAt: identity.updatedAt
      };
      const { data: createdUsers, error: createUserError } = await database.from("users").insert(user).select();
      if (createUserError) throw new Error(createUserError.message || "用户创建失败");
      const wechatIdentity = {
        id: identity.identityId,
        userId: user.id,
        openid: identity.openid,
        unionid: identity.unionid || "",
        createdAt: identity.createdAt,
        updatedAt: identity.updatedAt
      };
      const { error: createIdentityError } = await database.from("wechatIdentities").upsert(wechatIdentity, { onConflict: "openid" });
      if (createIdentityError) throw new Error(createIdentityError.message || "微信身份保存失败");
      return createdUsers?.[0] || user;
    },
    async createUserSession(record) {
      const { error } = await database.from("userSessions").insert(record);
      if (error) throw new Error(error.message || "用户会话保存失败");
    },
    async findUserBySession(tokenHash, now) {
      const { data: sessions, error: sessionError } = await database.from("userSessions").select("*").eq("tokenHash", tokenHash).gt("expiresAt", now).limit(1);
      if (sessionError) throw new Error(sessionError.message || "用户会话读取失败");
      if (!sessions?.[0]) return null;
      const { data, error } = await database.from("users").select("*").eq("id", sessions[0].userId).limit(1);
      if (error) throw new Error(error.message || "用户读取失败");
      return data?.[0] || null;
    },
    async listSignupsByUser(userId) {
      const { data, error } = await database.from("signups").select("*").eq("userId", userId).order("createdAt", { ascending: false }).limit(100);
      if (error) throw new Error(error.message || "用户报名读取失败");
      return data || [];
    },
    async findSignupByActivityPhone(activityId, phone) {
      const { data, error } = await database.from("signups").select("*").eq("activityId", activityId).eq("phone", phone).limit(1);
      if (error) throw new Error(error.message || "报名记录读取失败");
      return data?.[0] || null;
    },
    async saveSignupLocation(record) {
      const { data, error } = await database.from("signupLocations").upsert(record, { onConflict: "signupId" }).select();
      if (error) throw new Error(error.message || "报名坐标保存失败");
      return data?.[0] || record;
    },
    async attachSignupLocations(rows) {
      if (!rows.length) return rows;
      const activityIds = [...new Set(rows.map(item => item.activityId).filter(Boolean))];
      const locations = [];
      for (const activityId of activityIds) {
        const { data, error } = await database.from("signupLocations").select("*").eq("activityId", activityId).limit(1000);
        if (error) throw new Error(error.message || "报名坐标读取失败");
        locations.push(...(data || []));
      }
      const bySignup = new Map(locations.map(item => [item.signupId, item]));
      return rows.map(item => ({ ...item, ...(bySignup.get(item.id) || {}) }));
    },
    async updateSignupLifecycle(signupId, changes, operation) {
      const { data, error } = await database.from("signups").update(changes).eq("id", signupId).select();
      if (error) throw new Error(error.message || "报名状态更新失败");
      if (!data?.[0]) return null;
      const { error: operationError } = await database.from("signupOperations").insert(operation);
      if (operationError) throw new Error(operationError.message || "报名操作记录失败");
      return data[0];
    },
    async listSignupOperations(activityId) {
      const { data, error } = await database.from("signupOperations").select("*").eq("activityId", activityId).order("createdAt", { ascending: false }).limit(1000);
      if (error) throw new Error(error.message || "报名操作读取失败");
      return data || [];
    },
    async bindUserPhone(userId, phone, updatedAt) {
      const { data: users, error: userError } = await database.from("users").update({ phone, updatedAt }).eq("id", userId).select();
      if (userError) throw new Error(userError.message || "手机号绑定失败");
      const { data: signups, error: signupError } = await database.from("signups").select("*").eq("phone", phone).limit(100);
      if (signupError) throw new Error(signupError.message || "既有报名读取失败");
      const bindable = (signups || []).filter(item => !item.userId || item.userId === userId);
      for (const signup of bindable) {
        const { error } = await database.from("signups").update({ userId, updatedAt }).eq("id", signup.id);
        if (error) throw new Error(error.message || "既有报名绑定失败");
      }
      return { user: users?.[0] || { id: userId, phone, updatedAt }, boundSignups: bindable.length };
    },
    async saveSubscriptionGrant(record) {
      const { data, error } = await database.from("subscriptionGrants").upsert(record, { onConflict: "userId,templateId" }).select();
      if (error) throw new Error(error.message || "订阅授权保存失败");
      return data?.[0] || record;
    },
    async listSubscriptionGrants(userId) {
      const { data, error } = await database.from("subscriptionGrants").select("*").eq("userId", userId).order("updatedAt", { ascending: false }).limit(100);
      if (error) throw new Error(error.message || "订阅授权读取失败");
      return data || [];
    },
    async getAcceptedSubscriptionForUser(userId) {
      const { data, error } = await database.from("subscriptionGrants").select("*").eq("userId", userId).eq("status", "accept").order("updatedAt", { ascending: false }).limit(1);
      if (error) throw new Error(error.message || "订阅授权读取失败");
      return data?.[0] || null;
    },
    async getWechatRecipient(userId) {
      const { data, error } = await database.from("wechatIdentities").select("openid").eq("userId", userId).limit(1);
      if (error) throw new Error(error.message || "微信接收者读取失败");
      return data?.[0] || null;
    },
    async listNotificationsByUser(userId) {
      const signups = await this.listSignupsByUser(userId);
      const output = [];
      for (const signup of signups) {
        const { data, error } = await database.from("notifications").select("*").eq("signupId", signup.id).order("createdAt", { ascending: false }).limit(100);
        if (error) throw new Error(error.message || "通知记录读取失败");
        output.push(...(data || []));
      }
      return output.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))).slice(0, 100);
    },
    async updateNotification(record) {
      const { data, error } = await database.from("notifications").upsert(record, { onConflict: "id" }).select();
      if (error) throw new Error(error.message || "通知状态更新失败");
      return data?.[0] || record;
    },
    async saveSignupCapability(record) {
      const { error } = await database.from("participantCapabilities").upsert(record, { onConflict: "activityId,signupId" });
      if (error) throw new Error(error.message || "报名访问凭证保存失败");
    },
    async findSignupByCapability(signupId, tokenHash) {
      const { data: capabilities, error: capabilityError } = await database.from("participantCapabilities").select("*").eq("signupId", signupId).eq("tokenHash", tokenHash).limit(1);
      if (capabilityError) throw new Error(capabilityError.message || "报名访问凭证校验失败");
      if (!capabilities?.length) return null;
      const { data, error } = await database.from("signups").select("*").eq("id", signupId).limit(1);
      if (error) throw new Error(error.message || "报名信息读取失败");
      return data?.[0] || null;
    },
    async saveMatchRun(run, assignments) {
      const { error: runError } = await database.from("matchRuns").insert(run);
      if (runError) throw new Error(runError.message || "匹配运行保存失败");
      if (assignments.length) {
        const records = assignments.map(({ reasons, ...item }) => item);
        const { error } = await database.from("matchAssignments").insert(records);
        if (error) throw new Error(error.message || "匹配明细保存失败");
      }
      return { ...run, assignments };
    },
    async getLatestMatchRun(activityId) {
      const { data, error } = await database.from("matchRuns").select("*").eq("activityId", activityId).order("createdAt", { ascending: false }).limit(1);
      if (error) throw new Error(error.message || "匹配运行读取失败");
      return cloudMatchRun(data?.[0] || null);
    },
    async getMatchRun(runId) {
      const { data, error } = await database.from("matchRuns").select("*").eq("id", runId).limit(1);
      if (error) throw new Error(error.message || "匹配运行读取失败");
      return cloudMatchRun(data?.[0] || null);
    },
    async getMatchRunByAssignment(assignmentId) {
      const { data, error } = await database.from("matchAssignments").select("*").eq("id", assignmentId).limit(1);
      if (error) throw new Error(error.message || "匹配明细读取失败");
      return data?.[0] ? this.getMatchRun(data[0].matchRunId) : null;
    },
    async updateMatchAssignment(record) {
      const { reasons, ...stored } = record;
      void reasons;
      const { data, error } = await database.from("matchAssignments").upsert(stored, { onConflict: "id" }).select();
      if (error) throw new Error(error.message || "匹配明细更新失败");
      return data?.[0] || stored;
    },
    async confirmMatchRun(runId, confirmedAt, notifications) {
      const current = await this.getMatchRun(runId);
      if (!current) return null;
      if (current.status !== "confirmed") {
        const { error: supersedeError } = await database.from("matchRuns").update({ status: "superseded" }).eq("activityId", current.activityId).eq("status", "confirmed");
        if (supersedeError) throw new Error(supersedeError.message || "历史匹配状态更新失败");
        const { error: confirmError } = await database.from("matchRuns").update({ status: "confirmed", confirmedAt }).eq("id", runId);
        if (confirmError) throw new Error(confirmError.message || "匹配确认失败");
        if (notifications.length) {
          const { error } = await database.from("notifications").upsert(notifications, { onConflict: "dedupeKey" });
          if (error) throw new Error(error.message || "匹配通知创建失败");
        }
      }
      return this.getMatchRun(runId);
    },
    async getConfirmedMatchForSignup(activityId, signupId) {
      const { data, error } = await database.from("matchRuns").select("*").eq("activityId", activityId).eq("status", "confirmed").order("confirmedAt", { ascending: false }).limit(1);
      if (error) throw new Error(error.message || "已确认匹配读取失败");
      const run = await cloudMatchRun(data?.[0] || null);
      if (!run) return null;
      return {
        ...run,
        assignments: run.assignments.filter(item => item.ownerSignupId === signupId || item.riderSignupId === signupId)
      };
    },
    async assignRider(riderId, ownerId) {
      const { error } = await database.from("matchOverrides").upsert({ riderId, ownerId: ownerId || "", updatedAt: new Date().toISOString() }, { onConflict: "riderId" });
      if (error) throw new Error(error.message || "匹配调整失败");
    },
    prepare(sql) {
      const selectRows = async (values = []) => {
        let query = database.from("signups").select("*");
        if (/WHERE activity_id = \?/i.test(sql)) query = query.eq("activityId", values[0]);
        const { data, error } = await query.order("createdAt", { ascending: false }).limit(1000);
        if (error) throw new Error(error.message || "数据库读取失败");
        const { data: overrides, error: overrideError } = await database.from("matchOverrides").select("*").limit(1000);
        if (overrideError) throw new Error(overrideError.message || "人工匹配读取失败");
        const byRider = new Map((overrides || []).map(item => [item.riderId, item.ownerId]));
        return { results: (data || []).map(item => ({ ...item, assignedOwnerId: byRider.get(item.id) || item.assignedOwnerId || "", status: byRider.get(item.id) ? "已匹配" : item.status })) };
      };
      return {
        bind(...values) {
          return {
            async run() {
              if (!/INSERT INTO signups/i.test(sql)) return { success: true };
              const record = valuesToRecord(values);
              const { error } = await database.from("signups").upsert(toCloudSignupRow(record), { onConflict: "activityId,phone" });
              if (error) throw new Error(error.message || "数据库写入失败");
              return { success: true };
            },
            async all() { return selectRows(values); }
          };
        },
        async all() { return selectRows(); }
      };
    }
  };
}

function createWechatSubscribeSender(appId, appSecret) {
  if (!appId || !appSecret) return undefined;
  let cachedToken = "";
  let tokenExpiresAt = 0;
  return async ({ openid, templateId, page, data }) => {
    if (!cachedToken || tokenExpiresAt <= Date.now() + 60_000) {
      const tokenResponse = await fetch("https://api.weixin.qq.com/cgi-bin/stable_token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          grant_type: "client_credential",
          appid: appId,
          secret: appSecret,
          force_refresh: false
        })
      });
      const tokenValue = await tokenResponse.json();
      if (!tokenResponse.ok || tokenValue.errcode || !tokenValue.access_token) {
        throw new Error(tokenValue.errmsg || "微信服务凭证获取失败");
      }
      cachedToken = tokenValue.access_token;
      tokenExpiresAt = Date.now() + Math.max(300, Number(tokenValue.expires_in) || 7200) * 1000;
    }
    const response = await fetch(`https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${encodeURIComponent(cachedToken)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ touser: openid, template_id: templateId, page, data })
    });
    const value = await response.json();
    if (!response.ok || value.errcode) throw new Error(value.errmsg || "微信订阅消息发送失败");
    return value;
  };
}

function createMediaAnalyzer(endpoint, token) {
  if (!endpoint) return undefined;
  return async ({ name, type, bytes }) => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        name,
        type,
        contentBase64: Buffer.from(bytes).toString("base64"),
        outputs: ["focus", "coverScore", "crops"]
      })
    });
    const value = await response.json();
    if (!response.ok) throw new Error(value.message || "媒体智能分析失败");
    return value;
  };
}

const localMode = process.env.LOCAL_FILE_DB === "1";
function requireProductionEnv(name, localFallback = "") {
  const value = process.env[name];
  if (value) return value;
  if (localMode) return localFallback;
  throw new Error(`Missing required production environment variable: ${name}`);
}

if (!localMode) requireProductionEnv("CLOUDBASE_ENV_ID");
const adminPassword = requireProductionEnv("ADMIN_PASSWORD", "test-password");
const adminSessionSecret = requireProductionEnv("ADMIN_SESSION_SECRET", "local-development-secret-change-before-deploy");
const wechatAppId = requireProductionEnv("WECHAT_APP_ID");
const wechatAppSecret = requireProductionEnv("WECHAT_APP_SECRET");
const DB = localMode ? localDatabase() : cloudDatabase();
const env = {
  DB,
  ADMIN_PASSWORD: adminPassword,
  ADMIN_SESSION_SECRET: adminSessionSecret,
  WECHAT_APP_ID: wechatAppId,
  WECHAT_APP_SECRET: wechatAppSecret,
  WECHAT_SUBSCRIBE_SENDER: createWechatSubscribeSender(wechatAppId, wechatAppSecret),
  MEDIA_ANALYZER: createMediaAnalyzer(process.env.MEDIA_ANALYSIS_ENDPOINT, process.env.MEDIA_ANALYSIS_TOKEN)
};

async function nodeRequestToWeb(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const protocol = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers.host || `localhost:${PORT}`;
  const init = { method: req.method, headers: req.headers };
  if (body && req.method !== "GET" && req.method !== "HEAD") Object.assign(init, { body, duplex: "half" });
  return new Request(`${protocol}://${host}${req.url}`, init);
}

const server = http.createServer(async (req, res) => {
  try {
    const response = await worker.fetch(await nodeRequestToWeb(req), env, {});
    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error(error);
    res.statusCode = 500;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end("服务暂时繁忙");
  }
});

server.listen(PORT, "0.0.0.0", () => console.log(`鹿友自驾俱乐部已启动：http://localhost:${PORT}`));
