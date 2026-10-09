const PAGE = __HTML__;
const CSS = __CSS__;
const APP_JS = __JS__;
const LOGO = __LOGO__;
const HERO = __HERO__;
const DEPOSIT_QR = __DEPOSIT_QR__;
const PUBLIC_MAINTENANCE = false;
const PUBLIC_API_PATHS = new Set([
  "/api/signup",
  "/api/signup-form",
  "/api/stats",
  "/api/content",
  "/api/activities",
  "/api/health"
]);
const PUBLIC_CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, PUT, OPTIONS",
  "access-control-allow-headers": "authorization, content-type"
};
const LEGACY_ACTIVITY_ID = "legacy-main";

const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers }
});

const textResponse = (value, type, status = 200, headers = {}) => new Response(value, {
  status,
  headers: { "content-type": type, ...headers }
});

function withPublicCors(response) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(PUBLIC_CORS_HEADERS)) headers.set(name, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function isPublicApiPath(path) {
  return PUBLIC_API_PATHS.has(path)
    || path === "/api/v1/auth/wechat"
    || /^\/api\/v1\/me(?:\/(?:signups|subscriptions|notifications|phone))?$/.test(path)
    || /^\/api\/v1\/activities(?:\/[^/]+(?:\/(?:stats|signups|posts))?)?$/.test(path)
    || /^\/api\/v1\/me\/signups\/[^/]+\/match$/.test(path);
}

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function safeString(value, max = 200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function sha256(value) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

const DEFAULT_CONTENT = { id: "main", title: "张北草原 · 风起天路", dateText: "07.17—07.20 · 2天3夜", route: "北京 → 野狐岭 → 中都草原 → 桦皮岭 → 北京", timeline: "周五 19:30｜北京清河集合\n周五 20:00｜车队统一出发\n周六 08:30｜野狐岭进入草原天路\n周一 08:30｜统一返京", notice: "车辆出发前完成检查；服从领航与收尾调度；天气变化时以组织者最新通知为准。", recapTitle: "", recapText: "", recapPhotos: [], nextTitle: "", nextText: "", nextPhotos: [], publishedAt: "" };

function normalizeMedia(value) {
  let list = value;
  if (typeof list === "string") {
    try { list = JSON.parse(list); }
    catch { list = list.split(/\r?\n/).map(url => ({ url: url.trim(), type: "image/legacy" })); }
  }
  return (Array.isArray(list) ? list : []).map(item => typeof item === "string" ? { url: item, type: "image/legacy" } : item).filter(item => item && (item.fileId || /^https?:\/\//i.test(item.url || ""))).slice(0, 20).map(item => ({ fileId: safeString(item.fileId, 500), url: safeString(item.url, 2000), name: safeString(item.name, 200), type: safeString(item.type, 100) || "image/legacy" }));
}

async function getContent(env) {
  const stored = env.DB?.getContent ? await env.DB.getContent() : null;
  const value = { ...DEFAULT_CONTENT, ...(stored || {}) };
  for (const key of ["recapPhotos", "nextPhotos"]) value[key] = normalizeMedia(value[key]);
  if (env.DB?.resolveMedia) {
    value.recapPhotos = await env.DB.resolveMedia(value.recapPhotos);
    value.nextPhotos = await env.DB.resolveMedia(value.nextPhotos);
  }
  return value;
}

async function getActivities(env, requestedId = "") {
  const current = await getContent(env);
  let activities = env.DB?.getActivities ? await env.DB.getActivities() : [];
  if (!activities.length && (current.nextTitle || current.title)) activities = [{ ...current, id: "current", publishedAt: current.publishedAt || current.updatedAt || new Date().toISOString() }];
  activities = await Promise.all(activities.map(async item => {
    const value = { ...DEFAULT_CONTENT, ...item, recapPhotos: normalizeMedia(item.recapPhotos), nextPhotos: normalizeMedia(item.nextPhotos) };
    if (env.DB?.resolveMedia) value.nextPhotos = await env.DB.resolveMedia(value.nextPhotos);
    return value;
  }));
  activities.sort((a, b) => String(b.publishedAt || "").localeCompare(String(a.publishedAt || "")));
  return requestedId ? activities.find(item => item.id === requestedId) || null : activities;
}

function activityDto(record) {
  if (!record) return null;
  return {
    ...record,
    timeline: parseJsonList(record.timeline ?? record.timelineJson),
    media: normalizeMedia(record.media ?? record.mediaJson),
    timelineJson: undefined,
    mediaJson: undefined
  };
}

async function listPublishedActivities(env, activityId = "") {
  if (!env.DB?.listPublicActivities || !env.DB?.getPublicActivity) {
    const fallback = await getActivities(env, activityId);
    return activityId ? fallback : fallback.map(activityDto);
  }
  const value = activityId
    ? await env.DB.getPublicActivity(activityId)
    : await env.DB.listPublicActivities();
  if (activityId) return activityDto(value);
  return Promise.all((value || []).map(async item => {
    const result = activityDto(item);
    if (env.DB.resolveMedia) result.media = await env.DB.resolveMedia(result.media);
    return result;
  }));
}

async function saveActivityDraft(request, env, activityId = "") {
  if (!await isAdmin(request, env)) return json({ ok: false, message: "请先登录后台" }, 401);
  if (!env.DB?.saveActivityDraft) return json({ ok: false, message: "活动服务暂不可用" }, 503);
  const body = await request.json();
  const id = safeString(activityId || body.id, 80) || `activity-${Date.now().toString(36)}`;
  const current = env.DB.getAdminActivity ? await env.DB.getAdminActivity(id) : null;
  const now = new Date().toISOString();
  const timeline = Array.isArray(body.timeline)
    ? body.timeline.map(item => safeString(item, 500)).filter(Boolean)
    : safeString(body.timeline, 5000).split(/\r?\n/).filter(Boolean);
  const record = {
    ...(current || {}),
    id,
    title: safeString(body.title, 120) || current?.title || "",
    dateText: safeString(body.dateText, 120) || current?.dateText || "",
    startAt: safeString(body.startAt, 40) || current?.startAt || "",
    endAt: safeString(body.endAt, 40) || current?.endAt || "",
    route: safeString(body.route, 500) || current?.route || "",
    timelineJson: JSON.stringify(body.timeline == null ? parseJsonList(current?.timelineJson) : timeline),
    notice: body.notice == null ? current?.notice || "" : safeString(body.notice, 5000),
    summary: body.summary == null ? current?.summary || "" : safeString(body.summary, 5000),
    coverUrl: body.coverUrl == null ? current?.coverUrl || "" : safeString(body.coverUrl, 2000),
    mediaJson: JSON.stringify(body.media == null ? parseJsonList(current?.mediaJson) : normalizeMedia(body.media)),
    status: current?.status || "draft",
    signupOpen: body.signupOpen == null ? current?.signupOpen !== false : body.signupOpen === true,
    capacity: body.capacity == null ? Number(current?.capacity) || 0 : Math.max(0, Number(body.capacity) || 0),
    publishedVersion: Number(current?.publishedVersion) || 0,
    createdAt: current?.createdAt || now,
    updatedAt: now,
    publishedAt: current?.publishedAt || ""
  };
  if (!record.title || !record.dateText || !record.route) {
    return json({ ok: false, message: "请填写活动标题、日期和路线" }, 400);
  }
  const saved = await env.DB.saveActivityDraft(record);
  return json(activityDto(saved), current ? 200 : 201);
}

async function publishActivity(request, env, activityId, unpublish = false) {
  if (!await isAdmin(request, env)) return json({ ok: false, message: "请先登录后台" }, 401);
  const action = unpublish ? "unpublishActivity" : "publishActivity";
  if (!env.DB?.[action]) return json({ ok: false, message: "活动发布服务暂不可用" }, 503);
  const saved = await env.DB[action](activityId, new Date().toISOString());
  if (!saved) return json({ ok: false, message: "活动不存在" }, 404);
  await env.DB.writeAudit?.({
    id: crypto.randomUUID(),
    adminId: "session-admin",
    action: unpublish ? "activities.unpublish" : "activities.publish",
    resourceType: "activity",
    resourceId: activityId,
    metadataJson: JSON.stringify({ version: saved.publishedVersion || 0 }),
    createdAt: new Date().toISOString()
  });
  return json(activityDto(saved));
}

async function savePostDraft(request, env, postId = "") {
  if (!await isAdmin(request, env)) return json({ ok: false, message: "请先登录后台" }, 401);
  if (!env.DB?.savePostDraft) return json({ ok: false, message: "内容服务暂不可用" }, 503);
  const body = await request.json();
  const id = safeString(postId || body.id, 80) || `post-${Date.now().toString(36)}`;
  const now = new Date().toISOString();
  const record = {
    id,
    activityId: safeString(body.activityId, 80),
    type: body.type === "recap" ? "recap" : "recruitment",
    title: safeString(body.title, 160),
    contentJson: JSON.stringify(body.content && typeof body.content === "object" ? body.content : {}),
    status: "draft",
    version: 0,
    createdAt: now,
    updatedAt: now,
    publishedAt: ""
  };
  if (!record.activityId || !record.title) return json({ ok: false, message: "请选择活动并填写标题" }, 400);
  const saved = await env.DB.savePostDraft(record);
  return json({ ...saved, content: JSON.parse(saved.contentJson || "{}"), contentJson: undefined }, postId ? 200 : 201);
}

async function publishPost(request, env, postId) {
  if (!await isAdmin(request, env)) return json({ ok: false, message: "请先登录后台" }, 401);
  if (!env.DB?.publishPost) return json({ ok: false, message: "内容发布服务暂不可用" }, 503);
  const saved = await env.DB.publishPost(postId, new Date().toISOString());
  if (!saved) return json({ ok: false, message: "内容草稿不存在" }, 404);
  return json({ ...saved, content: JSON.parse(saved.contentJson || "{}"), contentJson: undefined });
}

async function listPublishedPosts(env, activityId, type) {
  if (!env.DB?.listPublicPosts) return json([]);
  const rows = await env.DB.listPublicPosts(activityId, type);
  return json((rows || []).map(item => ({
    ...item,
    content: typeof item.content === "object" ? item.content : JSON.parse(item.contentJson || "{}"),
    contentJson: undefined
  })));
}

function contentBlocks(input, template) {
  const highlights = Array.isArray(input.highlights)
    ? input.highlights.map(item => safeString(item, 100)).filter(Boolean).slice(0, 8)
    : [];
  const intro = safeString(input.summary, 1000)
    || `面向${safeString(input.audience, 120) || "自驾爱好者"}的${safeString(input.title, 160)}活动。`;
  const route = safeString(input.route, 500);
  const blocks = [
    { type: "hero", title: safeString(input.title, 160), text: intro },
    { type: "route", title: "行程路线", text: route }
  ];
  if (highlights.length) blocks.push({ type: "highlights", title: "活动亮点", items: highlights });
  blocks.push({
    type: "action",
    title: template === "social" ? "一起出发" : "报名参与",
    text: "确认时间与车辆状态后提交报名，组织者将统一发布车组安排。"
  });
  return blocks;
}

async function generateContentLayouts(request, env) {
  if (!await isAdmin(request, env)) return json({ ok: false, message: "请先登录后台" }, 401);
  if (!env.DB?.saveContentGeneration) return json({ ok: false, message: "智能排版服务暂不可用" }, 503);
  const body = await request.json();
  const activityId = safeString(body.activityId, 80);
  const title = safeString(body.title, 160);
  const route = safeString(body.route, 500);
  if (!activityId || !title || !route) return json({ ok: false, message: "请填写活动、标题和路线" }, 400);
  const input = {
    activityId,
    title,
    route,
    audience: safeString(body.audience, 120),
    summary: safeString(body.summary, 1000),
    highlights: Array.isArray(body.highlights) ? body.highlights.slice(0, 8) : []
  };
  const variants = [
    { template: "magazine", name: "旅行杂志", blocks: contentBlocks(input, "magazine") },
    { template: "route", name: "路线手册", blocks: contentBlocks(input, "route") },
    { template: "social", name: "社群招募", blocks: contentBlocks(input, "social") }
  ];
  const record = {
    id: crypto.randomUUID(),
    activityId,
    inputJson: JSON.stringify(input),
    variantsJson: JSON.stringify(variants),
    createdBy: "session-admin",
    createdAt: new Date().toISOString()
  };
  await env.DB.saveContentGeneration(record);
  return json({ id: record.id, activityId, variants }, 201);
}

async function updateSignupLifecycle(request, env, signupId) {
  if (!await isAdmin(request, env)) return json({ ok: false, message: "请先登录后台" }, 401);
  if (!env.DB?.updateSignupLifecycle) return json({ ok: false, message: "报名运营服务暂不可用" }, 503);
  const body = await request.json();
  const action = safeString(body.action, 30);
  const changes = {
    waitlist: { signupStatus: "候补" },
    confirm: { signupStatus: "已报名" },
    cancel: { signupStatus: "已取消" },
    refund: { depositStatus: "已退款" },
    checkin: {}
  };
  if (!Object.hasOwn(changes, action)) return json({ ok: false, message: "不支持的报名操作" }, 400);
  const rows = await signupRows(env);
  const signup = rows.find(item => item.id === signupId);
  if (!signup) return json({ ok: false, message: "报名记录不存在" }, 404);
  const now = new Date().toISOString();
  const operation = {
    id: crypto.randomUUID(),
    activityId: signup.activityId,
    signupId,
    type: action,
    status: "completed",
    amount: action === "refund" ? Math.max(0, Math.round(Number(body.amount) || 0)) : 0,
    note: safeString(body.note, 500),
    createdBy: "session-admin",
    createdAt: now
  };
  const saved = await env.DB.updateSignupLifecycle(
    signupId,
    { ...changes[action], updatedAt: now },
    operation
  );
  await env.DB.writeAudit?.({
    id: crypto.randomUUID(),
    adminId: "session-admin",
    action: `signups.${action}`,
    resourceType: "signup",
    resourceId: signupId,
    metadataJson: JSON.stringify({ activityId: signup.activityId, amount: operation.amount }),
    createdAt: now
  });
  return json({ signup: signupForParticipant(saved), operation });
}

async function getActivityDashboard(request, env, activityId) {
  if (!await isAdmin(request, env)) return json({ ok: false, message: "请先登录后台" }, 401);
  const rows = await signupRows(env, activityId);
  const operations = await env.DB.listSignupOperations?.(activityId) || [];
  const latestMatch = await env.DB.getLatestMatchRun?.(activityId);
  const assignments = latestMatch?.assignments || [];
  const matched = assignments.filter(item => item.ownerSignupId).length;
  const refundedAmount = operations
    .filter(item => item.type === "refund" && item.status === "completed")
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  return json({
    activityId,
    signups: {
      total: rows.length,
      owners: rows.filter(item => item.role === "owner").length,
      riders: rows.filter(item => item.role === "rider").length,
      waitlist: rows.filter(item => item.signupStatus === "候补").length,
      cancelled: rows.filter(item => item.signupStatus === "已取消").length
    },
    capacity: {
      seats: rows.filter(item => item.role === "owner").reduce((sum, item) => sum + (Number(item.seats) || 0), 0),
      riders: rows.filter(item => item.role === "rider" && item.signupStatus === "已报名").length
    },
    finance: {
      confirmedDeposits: rows.filter(item => item.depositStatus === "已确认").length,
      pendingDeposits: rows.filter(item => item.depositStatus === "待核验").length,
      refundedAmount
    },
    checkin: {
      checkedIn: new Set(operations.filter(item => item.type === "checkin" && item.status === "completed").map(item => item.signupId)).size
    },
    matching: {
      status: latestMatch?.status || "empty",
      matched,
      waiting: Math.max(0, rows.filter(item => item.role === "rider" && item.signupStatus === "已报名").length - matched),
      averageScore: matched
        ? Math.round(assignments.filter(item => item.ownerSignupId).reduce((sum, item) => sum + (Number(item.score) || 0), 0) / matched)
        : 0
    }
  });
}

async function saveContent(request, env) {
  if (!await isAdmin(request, env)) return json({ ok: false, message: "请先登录后台" }, 401);
  const body = await request.json();
  const current = await getContent(env);
  const record = { id: "main", title: safeString(body.title, 100) || current.title, dateText: safeString(body.dateText, 100), route: safeString(body.route, 300), timeline: safeString(body.timeline, 4000), notice: safeString(body.notice, 3000), recapTitle: safeString(body.recapTitle, 120), recapText: safeString(body.recapText, 5000), recapPhotos: JSON.stringify(normalizeMedia(body.recapPhotos ?? current.recapPhotos)), nextTitle: safeString(body.nextTitle, 120), nextText: safeString(body.nextText, 5000), nextPhotos: JSON.stringify(normalizeMedia(body.nextPhotos ?? current.nextPhotos)), updatedAt: new Date().toISOString(), publishedAt: body.published ? new Date().toISOString() : current.publishedAt || "" };
  await env.DB.saveContent(record);
  let activityId = "";
  if (body.published && body.section === "next" && env.DB?.saveActivity) {
    activityId = `trip-${Date.now().toString(36)}`;
    await env.DB.saveActivity({ ...record, id: activityId, recapPhotos: [], nextPhotos: normalizeMedia(body.nextPhotos ?? current.nextPhotos) });
  }
  return json({ ok: true, activityId });
}

async function uploadMedia(request, env, requireActivity = false) {
  if (!await isAdmin(request, env)) return json({ ok: false, message: "请先登录后台" }, 401);
  if (!env.DB?.uploadMedia) return json({ ok: false, message: "媒体存储暂不可用" }, 503);
  const form = await request.formData();
  const file = form.get("file");
  const activityId = safeString(form.get("activityId"), 80);
  if (requireActivity && !activityId) return json({ ok: false, message: "请选择媒体所属活动" }, 400);
  if (!file || typeof file.arrayBuffer !== "function") return json({ ok: false, message: "请选择照片或视频" }, 400);
  const type = safeString(file.type, 100);
  if (!/^(image|video)\//.test(type)) return json({ ok: false, message: "仅支持照片和视频" }, 400);
  if (file.size > 30 * 1024 * 1024) return json({ ok: false, message: "单个文件请勿超过 30MB" }, 413);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const saved = await env.DB.uploadMedia(safeString(file.name, 200) || "media", type, bytes);
  const rawAnalysis = type.startsWith("image/") && typeof env.MEDIA_ANALYZER === "function"
    ? await env.MEDIA_ANALYZER({ name: file.name, type, bytes })
    : {};
  const focusX = Math.max(0, Math.min(1, Number(rawAnalysis?.focusX) || 0.5));
  const focusY = Math.max(0, Math.min(1, Number(rawAnalysis?.focusY) || 0.5));
  const coverScore = Math.max(0, Math.min(100, Math.round(Number(rawAnalysis?.coverScore) || 0)));
  const cropSuggestions = Array.isArray(rawAnalysis?.cropSuggestions)
    ? rawAnalysis.cropSuggestions.slice(0, 8)
    : [
        { ratio: "16:9", x: 0, y: 0.125, width: 1, height: 0.75 },
        { ratio: "4:3", x: 0, y: 0, width: 1, height: 1 }
      ];
  Object.assign(saved, { focusX, focusY, coverScore, cropSuggestions });
  if (env.DB.createMediaAsset && activityId) {
    const asset = await env.DB.createMediaAsset({
      id: crypto.randomUUID(),
      activityId,
      storagePath: saved.fileId,
      name: safeString(file.name, 200) || "media",
      mimeType: type,
      size: Number(file.size) || 0,
      status: "uploaded",
      focusX,
      focusY,
      coverScore,
      cropSuggestionsJson: JSON.stringify(cropSuggestions),
      createdAt: new Date().toISOString()
    });
    saved.id = asset.id;
  }
  const resolved = env.DB.resolveMedia ? await env.DB.resolveMedia([saved]) : [saved];
  return json({ ok: true, media: resolved[0] });
}

async function saveManualMatch(request, env) {
  if (!await isAdmin(request, env)) return json({ ok: false, message: "请先登录后台" }, 401);
  const body = await request.json();
  const riderId = safeString(body.riderId, 80), ownerId = safeString(body.ownerId, 80);
  if (!riderId) return json({ ok: false, message: "请选择搭车成员" }, 400);
  if (!env.DB?.assignRider) return json({ ok: false, message: "匹配服务暂不可用" }, 503);
  await env.DB.assignRider(riderId, ownerId);
  return json({ ok: true });
}

function cookieValue(request, name) {
  const match = request.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : "";
}

async function hmac(value, secret) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
  return [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function makeSession(secret) {
  const expires = Date.now() + 12 * 60 * 60 * 1000;
  return `${expires}.${await hmac(String(expires), secret)}`;
}

function constantTimeEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string" || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function isAdmin(request, env) {
  if (!env.ADMIN_SESSION_SECRET) return false;
  const [expires, signature] = cookieValue(request, "deer_admin").split(".");
  if (!expires || !signature || Number(expires) < Date.now()) return false;
  return constantTimeEqual(signature, await hmac(expires, env.ADMIN_SESSION_SECRET));
}

function isTrustedAdminMutation(request, env, path) {
  if (env.TEST_MODE === "true") return true;
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return true;
  if (!(path.startsWith("/api/admin/") || path.startsWith("/api/v1/admin/"))) return true;
  if (path === "/api/admin/login") return true;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function bearerToken(request) {
  const authorization = request.headers.get("authorization") || "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
}

async function sessionUser(request, env) {
  const token = bearerToken(request);
  if (!token || !env.DB?.findUserBySession) return null;
  return env.DB.findUserBySession(await sha256(token), new Date().toISOString());
}

async function exchangeWechatCode(code, env) {
  if (typeof env.WECHAT_CODE_EXCHANGE === "function") return env.WECHAT_CODE_EXCHANGE(code);
  if (!env.WECHAT_APP_ID || !env.WECHAT_APP_SECRET) {
    throw new Error("微信登录配置不完整");
  }
  const query = new URLSearchParams({
    appid: env.WECHAT_APP_ID,
    secret: env.WECHAT_APP_SECRET,
    js_code: code,
    grant_type: "authorization_code"
  });
  const response = await fetch(`https://api.weixin.qq.com/sns/jscode2session?${query}`);
  const value = await response.json();
  if (!response.ok || value.errcode || !value.openid) {
    throw new Error(safeString(value.errmsg, 200) || "微信登录失败");
  }
  return value;
}

async function loginWechat(request, env) {
  if (!env.DB?.upsertWechatUser || !env.DB?.createUserSession) {
    return json({ ok: false, message: "微信登录服务暂不可用" }, 503);
  }
  const body = await request.json();
  const code = safeString(body.code, 200);
  if (!code) return json({ ok: false, message: "缺少微信登录凭证" }, 400);
  const identity = await exchangeWechatCode(code, env);
  const now = new Date().toISOString();
  const user = await env.DB.upsertWechatUser({
    id: crypto.randomUUID(),
    identityId: crypto.randomUUID(),
    openid: safeString(identity.openid, 160),
    unionid: safeString(identity.unionid, 160),
    createdAt: now,
    updatedAt: now
  });
  const token = `${crypto.randomUUID()}${crypto.randomUUID().replaceAll("-", "")}`;
  await env.DB.createUserSession({
    id: crypto.randomUUID(),
    userId: user.id,
    tokenHash: await sha256(token),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: now
  });
  return json({ ok: true, token, user: { id: user.id } });
}

async function exchangeWechatPhone(code, env) {
  if (typeof env.WECHAT_PHONE_EXCHANGE === "function") return env.WECHAT_PHONE_EXCHANGE(code);
  if (!env.WECHAT_APP_ID || !env.WECHAT_APP_SECRET) throw new Error("微信手机号配置不完整");
  const tokenResponse = await fetch("https://api.weixin.qq.com/cgi-bin/stable_token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credential",
      appid: env.WECHAT_APP_ID,
      secret: env.WECHAT_APP_SECRET,
      force_refresh: false
    })
  });
  const tokenValue = await tokenResponse.json();
  if (!tokenResponse.ok || tokenValue.errcode || !tokenValue.access_token) {
    throw new Error(safeString(tokenValue.errmsg, 200) || "微信服务凭证获取失败");
  }
  const phoneResponse = await fetch(`https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${encodeURIComponent(tokenValue.access_token)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code })
  });
  const phoneValue = await phoneResponse.json();
  if (!phoneResponse.ok || phoneValue.errcode || !phoneValue.phone_info?.purePhoneNumber) {
    throw new Error(safeString(phoneValue.errmsg, 200) || "微信手机号获取失败");
  }
  return { phoneNumber: phoneValue.phone_info.purePhoneNumber };
}

async function bindWechatPhone(request, env) {
  const user = await sessionUser(request, env);
  if (!user) return json({ ok: false, message: "请先登录" }, 401);
  if (!env.DB?.bindUserPhone) return json({ ok: false, message: "手机号绑定服务暂不可用" }, 503);
  const body = await request.json();
  const code = safeString(body.code, 200);
  if (!code) return json({ ok: false, message: "缺少手机号授权凭证" }, 400);
  const value = await exchangeWechatPhone(code, env);
  const phone = safeString(value.phoneNumber, 30);
  if (!phone) return json({ ok: false, message: "未获取到手机号" }, 400);
  const result = await env.DB.bindUserPhone(user.id, phone, new Date().toISOString());
  return json({ ok: true, boundSignups: Number(result?.boundSignups) || 0 });
}

function signupForParticipant(row) {
  return {
    id: row.id,
    activityId: row.activityId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    status: row.status,
    signupStatus: row.signupStatus,
    name: row.name,
    role: row.role,
    gender: row.gender || "",
    age: row.age || "",
    zodiac: row.zodiac || "",
    work: row.work,
    home: row.home,
    pickup: row.pickup || "",
    vehicle: row.vehicle || "",
    licensePlate: row.licensePlate || "",
    seats: Number(row.seats) || 0,
    note: row.note || "",
    smoking: row.smoking || "",
    acceptsSmoking: row.acceptsSmoking || "",
    roomType: row.roomType || "",
    modifications: parseJsonList(row.modifications ?? row.modificationsJson),
    interests: parseJsonList(row.interests ?? row.interestsJson),
    depositStatus: row.depositStatus || ""
  };
}

async function getMySignups(request, env) {
  const user = await sessionUser(request, env);
  if (!user) return json({ ok: false, message: "请先登录" }, 401);
  if (!env.DB?.listSignupsByUser) return json({ ok: false, message: "报名查询暂不可用" }, 503);
  const rows = await env.DB.listSignupsByUser(user.id);
  return json((rows || []).map(signupForParticipant));
}

async function saveSubscription(request, env) {
  const user = await sessionUser(request, env);
  if (!user) return json({ ok: false, message: "请先登录" }, 401);
  if (!env.DB?.saveSubscriptionGrant) return json({ ok: false, message: "订阅服务暂不可用" }, 503);
  const body = await request.json();
  const templateId = safeString(body.templateId, 160);
  const status = ["accept", "reject", "ban"].includes(body.status) ? body.status : "";
  if (!templateId || !status) return json({ ok: false, message: "订阅授权信息不完整" }, 400);
  const now = new Date().toISOString();
  const grant = await env.DB.saveSubscriptionGrant({
    id: crypto.randomUUID(),
    userId: user.id,
    templateId,
    status,
    templateVersion: safeString(body.templateVersion, 80),
    grantedAt: status === "accept" ? now : "",
    updatedAt: now
  });
  return json(grant, 201);
}

async function listMySubscriptions(request, env) {
  const user = await sessionUser(request, env);
  if (!user) return json({ ok: false, message: "请先登录" }, 401);
  return json(await env.DB.listSubscriptionGrants?.(user.id) || []);
}

async function listMyNotifications(request, env) {
  const user = await sessionUser(request, env);
  if (!user) return json({ ok: false, message: "请先登录" }, 401);
  return json(await env.DB.listNotificationsByUser?.(user.id) || []);
}

const LOGIN_PAGE = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>鹿友后台登录</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f3efe7;color:#173028;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}.card{width:min(92vw,420px);padding:38px;background:#fff;border-radius:28px;box-shadow:0 20px 60px #17302820}.mark{font-size:42px}h1{margin:14px 0 8px}p{color:#6c7771}input,button{width:100%;height:52px;border-radius:14px;font:inherit}input{border:1px solid #d9ddd9;padding:0 16px;margin:20px 0 12px}button{border:0;background:#173f32;color:white;font-weight:700;cursor:pointer}.error{color:#b43d2f;font-size:14px}</style></head><body><form class="card" method="post" action="/api/admin/login"><div class="mark">🦌</div><h1>鹿友管理后台</h1><p>仅限活动组织者访问</p><input type="password" name="password" placeholder="请输入后台密码" autocomplete="current-password" required><button type="submit">进入后台</button><div class="error">{{ERROR}}</div></form></body></html>`;
const CLOSED_PAGE = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>鹿友报名维护中</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#111816;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}.card{text-align:center;padding:40px}.mark{font-size:56px}h1{margin:16px 0 8px}p{color:#aeb7b2;line-height:1.7}</style></head><body><div class="card"><div class="mark">🦌</div><h1>报名通道暂时关闭</h1><p>鹿友正在优化报名体验<br>重新开放后请再次扫码进入</p></div></body></html>`;

async function login(request, env) {
  const form = await request.formData();
  if (!env.ADMIN_PASSWORD || form.get("password") !== env.ADMIN_PASSWORD) {
    return textResponse(LOGIN_PAGE.replace("{{ERROR}}", "密码不正确，请重试"), "text/html; charset=utf-8", 401);
  }
  const session = await makeSession(env.ADMIN_SESSION_SECRET);
  return new Response(null, { status: 303, headers: { location: "/admin", "set-cookie": `deer_admin=${encodeURIComponent(session)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200` } });
}

async function saveSignup(request, env, activityIdOverride = "") {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, message: "报名信息格式不正确" }, 400); }
  const authorization = bearerToken(request);
  const user = authorization ? await sessionUser(request, env) : null;
  if (authorization && !user) return json({ ok: false, message: "登录状态已失效" }, 401);
  const record = {
    id: crypto.randomUUID(), createdAt: new Date().toISOString(), name: safeString(body.name, 50),
    activityId: safeString(activityIdOverride || body.activityId, 80) || LEGACY_ACTIVITY_ID,
    userId: user?.id || "",
    phone: safeString(body.phone, 30), wechat: safeString(body.wechat, 80), role: body.role === "owner" ? "owner" : "rider",
    gender: safeString(body.gender, 20), age: safeString(body.age, 10), zodiac: safeString(body.zodiac, 20),
    work: safeString(body.work), home: safeString(body.home), pickup: safeString(body.pickup),
    vehicle: safeString(body.vehicle, 100), licensePlate: body.role === "owner" ? safeString(body.licensePlate, 20).toUpperCase() : "", seats: Math.max(0, Math.min(8, Number(body.seats) || 0)),
    note: safeString(body.note, 500), smoking: body.smoking === "吸烟" ? "吸烟" : "不吸烟",
    acceptsSmoking: body.acceptsSmoking === "接受" ? "接受" : "不接受",
    roomType: body.roomType === "标间" ? "标间" : "单间",
    modifications: body.role === "owner" && Array.isArray(body.modifications) ? body.modifications.filter(item => ["轮胎", "减震", "绞盘"].includes(item)) : [],
    modificationOther: "",
    depositStatus: body.depositConfirmed === true || body.depositConfirmed === "yes" ? "待核验" : "待支付",
    interests: Array.isArray(body.interests) ? body.interests.slice(0, 5).map(item => safeString(item, 30)).filter(Boolean) : [],
    signupStatus: "已报名",
    contactConsent: body.contactConsent === true,
    notificationConsent: body.notificationConsent === true
  };
  if (!record.name || !record.phone || !record.wechat || !record.work || !record.home) return json({ ok: false, message: "请填写姓名、手机号、微信号、工作地点和居住地点" }, 400);
  if (record.role === "owner" && !record.licensePlate) return json({ ok: false, message: "请填写完整车牌号" }, 400);
  if (record.depositStatus !== "待核验") return json({ ok: false, message: "请支付200元定金并确认退款规则" }, 400);
  if (!env.DB) return json({ ok: false, message: "报名服务暂不可用，请稍后再试" }, 503);
  const existing = await env.DB.findSignupByActivityPhone?.(record.activityId, record.phone);
  if (existing?.id) {
    record.id = existing.id;
    record.createdAt = existing.createdAt || record.createdAt;
  }
  record.status = existing?.status || "待匹配";
  await env.DB.prepare(`INSERT INTO signups (id, created_at, updated_at, status, activity_id, user_id, name, phone, wechat, role, gender, age, zodiac, work, home, pickup, vehicle, license_plate, seats, note, smoking, accepts_smoking, room_type, modifications_json, modification_other, deposit_status, interests_json, signup_status, contact_consent, notification_consent)
    VALUES (?, ?, ?, '待匹配', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(activity_id, phone) DO UPDATE SET updated_at=excluded.updated_at, user_id=excluded.user_id, name=excluded.name, wechat=excluded.wechat, role=excluded.role, gender=excluded.gender, age=excluded.age, zodiac=excluded.zodiac, work=excluded.work, home=excluded.home, pickup=excluded.pickup, vehicle=excluded.vehicle, license_plate=excluded.license_plate, seats=excluded.seats, note=excluded.note, smoking=excluded.smoking, accepts_smoking=excluded.accepts_smoking, room_type=excluded.room_type, modifications_json=excluded.modifications_json, modification_other=excluded.modification_other, deposit_status=excluded.deposit_status, interests_json=excluded.interests_json, signup_status=excluded.signup_status, contact_consent=excluded.contact_consent, notification_consent=excluded.notification_consent`)
    .bind(record.id, record.createdAt, record.createdAt, record.activityId, record.userId, record.name, record.phone, record.wechat, record.role, record.gender, record.age, record.zodiac, record.work, record.home, record.pickup, record.vehicle, record.licensePlate, record.seats, record.note, record.smoking, record.acceptsSmoking, record.roomType, JSON.stringify(record.modifications), record.modificationOther, record.depositStatus, JSON.stringify(record.interests), record.signupStatus, record.contactConsent ? 1 : 0, record.notificationConsent ? 1 : 0).run();
  if (env.DB.saveSignupLocation) {
    const coordinate = value => Number.isFinite(Number(value)) ? Number(value) : null;
    await env.DB.saveSignupLocation({
      signupId: record.id,
      activityId: record.activityId,
      homeLat: coordinate(body.homeLat),
      homeLng: coordinate(body.homeLng),
      pickupLat: coordinate(body.pickupLat),
      pickupLng: coordinate(body.pickupLng),
      updatedAt: record.createdAt
    });
  }
  const accessToken = `${crypto.randomUUID()}${crypto.randomUUID().replaceAll("-", "")}`;
  if (env.DB.saveSignupCapability) {
    await env.DB.saveSignupCapability({
      id: crypto.randomUUID(),
      activityId: record.activityId,
      signupId: record.id,
      tokenHash: await sha256(accessToken),
      createdAt: record.createdAt,
      updatedAt: record.createdAt
    });
  }
  return json({ ok: true, id: record.id, status: record.status, accessToken }, 201);
}

async function saveSignupForm(request, env) {
  const form = await request.formData();
  const body = Object.fromEntries(form);
  const record = {
    id: crypto.randomUUID(), createdAt: new Date().toISOString(), name: safeString(body.name, 50),
    activityId: safeString(body.activityId, 80) || LEGACY_ACTIVITY_ID,
    userId: safeString(body.userId, 120),
    phone: safeString(body.phone, 30), wechat: safeString(body.wechat, 80), role: body.role === "owner" ? "owner" : "rider",
    gender: safeString(body.gender, 20), age: safeString(body.age, 10), zodiac: safeString(body.zodiac, 20),
    work: safeString(body.work), home: safeString(body.home), pickup: safeString(body.pickup),
    vehicle: safeString(body.vehicle, 100), licensePlate: body.role === "owner" ? safeString(body.licensePlate, 20).toUpperCase() : "", seats: Math.max(0, Math.min(8, Number(body.seats) || 0)),
    note: safeString(body.note, 500), smoking: body.smoking === "吸烟" ? "吸烟" : "不吸烟",
    acceptsSmoking: body.acceptsSmoking === "接受" ? "接受" : "不接受",
    roomType: body.roomType === "标间" ? "标间" : "单间",
    modifications: body.role === "owner" ? form.getAll("modifications").filter(item => ["轮胎", "减震", "绞盘"].includes(item)) : [],
    modificationOther: "",
    depositStatus: body.depositConfirmed === "yes" ? "待核验" : "待支付",
    interests: form.getAll("interests").slice(0, 5).map(item => safeString(item, 30)).filter(Boolean),
    signupStatus: "已报名",
    contactConsent: body.contactConsent === "yes",
    notificationConsent: body.notificationConsent === "yes"
  };
  if (!record.name || !record.phone || !record.wechat || !record.work || !record.home) return textResponse("报名资料不完整，请填写姓名、手机号、微信号、工作地点和居住地点。", "text/plain; charset=utf-8", 400);
  if (record.role === "owner" && !record.licensePlate) return textResponse("请填写完整车牌号。", "text/plain; charset=utf-8", 400);
  if (record.depositStatus !== "待核验") return textResponse("请支付200元定金并确认退款规则。", "text/plain; charset=utf-8", 400);
  if (!env.DB) return textResponse("报名服务暂不可用，请稍后再试。", "text/plain; charset=utf-8", 503);
  await env.DB.prepare(`INSERT INTO signups (id, created_at, updated_at, status, activity_id, user_id, name, phone, wechat, role, gender, age, zodiac, work, home, pickup, vehicle, license_plate, seats, note, smoking, accepts_smoking, room_type, modifications_json, modification_other, deposit_status, interests_json, signup_status, contact_consent, notification_consent)
    VALUES (?, ?, ?, '待匹配', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(activity_id, phone) DO UPDATE SET updated_at=excluded.updated_at, user_id=excluded.user_id, name=excluded.name, wechat=excluded.wechat, role=excluded.role, gender=excluded.gender, age=excluded.age, zodiac=excluded.zodiac, work=excluded.work, home=excluded.home, pickup=excluded.pickup, vehicle=excluded.vehicle, license_plate=excluded.license_plate, seats=excluded.seats, note=excluded.note, smoking=excluded.smoking, accepts_smoking=excluded.accepts_smoking, room_type=excluded.room_type, modifications_json=excluded.modifications_json, modification_other=excluded.modification_other, deposit_status=excluded.deposit_status, interests_json=excluded.interests_json, signup_status=excluded.signup_status, contact_consent=excluded.contact_consent, notification_consent=excluded.notification_consent`)
    .bind(record.id, record.createdAt, record.createdAt, record.activityId, record.userId, record.name, record.phone, record.wechat, record.role, record.gender, record.age, record.zodiac, record.work, record.home, record.pickup, record.vehicle, record.licensePlate, record.seats, record.note, record.smoking, record.acceptsSmoking, record.roomType, JSON.stringify(record.modifications), record.modificationOther, record.depositStatus, JSON.stringify(record.interests), record.signupStatus, record.contactConsent ? 1 : 0, record.notificationConsent ? 1 : 0).run();
  return new Response(null, { status: 303, headers: { location: "/submitted" } });
}

function renderPage(path, url) {
  const screen = path === "/journey" ? "journeyScreen" : path === "/trip" ? "tripScreen" : path === "/signup" ? "formScreen" : path === "/submitted" ? "profileScreen" : url.searchParams.get("screen") === "journey" ? "journeyScreen" : "homeScreen";
  let page = PAGE.replace(/class="screen active/g, 'class="screen');
  page = page.replace(`id="${screen}" class="screen`, `id="${screen}" class="screen active`);
  if (screen === "formScreen") {
    const role = url.searchParams.get("role") === "owner" ? "owner" : "rider";
    const activityId = safeString(url.searchParams.get("activity"), 80) || LEGACY_ACTIVITY_ID;
    page = page.replace("<body>", `<body class="server-form" data-signup-role="${role}">`)
      .replace('<form id="signupForm" class="signup-form">', `<form id="signupForm" class="signup-form" method="post" action="/api/signup-form"><input type="hidden" name="role" value="${role}"><input type="hidden" name="activityId" value="${escapeHtml(activityId)}">`)
      .replace('id="formTitle">参与报名', `id="formTitle">${role === "owner" ? "车主报名" : "搭车报名"}`);
    if (role === "owner") page = page.replace('id="vehicleFields" class="vehicle-fields"', 'id="vehicleFields" class="vehicle-fields active"');
  }
  return page;
}

async function listSignups(env, activityId = "") {
  if (!env.DB) return json({ message: "数据库暂不可用" }, 503);
  const rows = await signupRows(env, activityId);
  return json(rows.map(row => ({ ...row, interestsJson: undefined, modificationsJson: undefined })));
}

function parseJsonList(value) {
  if (Array.isArray(value)) return value;
  try { return JSON.parse(value || "[]"); } catch { return []; }
}

async function signupRows(env, activityId = "") {
  if (!env.DB) return [];
  const sql = `SELECT id, created_at AS createdAt, updated_at AS updatedAt, status, activity_id AS activityId, user_id AS userId, name, phone, wechat, role, gender, age, zodiac, work, home, pickup, vehicle, license_plate AS licensePlate, seats, note, smoking, accepts_smoking AS acceptsSmoking, room_type AS roomType, modifications_json AS modificationsJson, modification_other AS modificationOther, deposit_status AS depositStatus, interests_json AS interestsJson, signup_status AS signupStatus, contact_consent AS contactConsent, notification_consent AS notificationConsent, assigned_owner_id AS assignedOwnerId FROM signups${activityId ? " WHERE activity_id = ?" : ""} ORDER BY created_at DESC LIMIT 1000`;
  const statement = env.DB.prepare(sql);
  const result = activityId ? await statement.bind(activityId).all() : await statement.all();
  const rows = (result.results || []).map(row => ({ ...row, interests: parseJsonList(row.interestsJson), modifications: parseJsonList(row.modificationsJson) }));
  return env.DB.attachSignupLocations ? env.DB.attachSignupLocations(rows) : rows;
}

function csvCell(value) {
  const text = Array.isArray(value) ? value.join("、") : String(value == null ? "" : value);
  return `"${text.replace(/"/g, '""')}"`;
}

async function exportSignups(request, env, activityId) {
  if (!await isAdmin(request, env)) return json({ ok: false, message: "请先登录后台" }, 401);
  const rows = await signupRows(env, activityId);
  const columns = [
    ["报名时间", "createdAt"], ["姓名", "name"], ["手机号", "phone"], ["微信号", "wechat"],
    ["身份", "role"], ["性别", "gender"], ["年龄段", "age"], ["星座", "zodiac"],
    ["工作地点", "work"], ["居住地点", "home"], ["集合地点", "pickup"], ["车辆", "vehicle"],
    ["车牌", "licensePlate"], ["座位", "seats"], ["改装情况", "modifications"], ["兴趣", "interests"],
    ["吸烟", "smoking"], ["接受吸烟", "acceptsSmoking"], ["房型", "roomType"], ["备注", "note"],
    ["定金状态", "depositStatus"], ["报名状态", "signupStatus"], ["匹配状态", "status"], ["所属车组", "assignedOwnerId"]
  ];
  const csv = `\uFEFF${[
    columns.map(([label]) => csvCell(label)).join(","),
    ...rows.map(row => columns.map(([, key]) => csvCell(row[key])).join(","))
  ].join("\r\n")}`;
  if (env.DB?.writeAudit) {
    await env.DB.writeAudit({
      id: crypto.randomUUID(),
      adminId: "session-admin",
      action: "signups.export",
      resourceType: "activity",
      resourceId: activityId,
      metadataJson: JSON.stringify({ rowCount: rows.length }),
      createdAt: new Date().toISOString()
    });
  }
  return textResponse(csv, "text/csv; charset=utf-8", 200, {
    "cache-control": "no-store",
    "content-disposition": `attachment; filename="signups-${encodeURIComponent(activityId)}.csv"`
  });
}

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function createGroups(rows) {
  const owners = rows.filter(row => row.role === "owner").map(row => ({ ...row, remaining: Math.max(0, Number(row.seats) || 0), people: [] }));
  const riders = rows.filter(row => row.role === "rider");
  for (const rider of riders.filter(item => item.assignedOwnerId)) {
    const owner = owners.find(item => String(item.id) === String(rider.assignedOwnerId) && item.remaining > 0);
    if (owner) { owner.people.push({ ...rider, matchScore: 100, manual: true }); owner.remaining -= 1; }
  }
  for (const rider of riders.filter(item => !item.assignedOwnerId)) {
    const candidates = owners.filter(owner => owner.remaining > 0).map(owner => {
      const smokingConflict = (rider.smoking === "吸烟" && owner.acceptsSmoking !== "接受") || (owner.smoking === "吸烟" && rider.acceptsSmoking !== "接受");
      if (smokingConflict) return null;
      const shared = (rider.interests || []).filter(item => (owner.interests || []).includes(item)).length;
      const location = owner.home && rider.home && (owner.home.slice(0, 3) === rider.home.slice(0, 3) || owner.home.includes(rider.home.slice(0, 2))) ? 45 : 15;
      const smokingFit = rider.smoking === owner.smoking ? 8 : 3;
      return { owner, score: Math.min(98, 37 + location + shared * 8 + smokingFit) };
    }).filter(Boolean).sort((a, b) => b.score - a.score);
    if (candidates[0]) { candidates[0].owner.people.push({ ...rider, matchScore: candidates[0].score }); candidates[0].owner.remaining -= 1; }
  }
  return owners;
}

function smokingCompatible(owner, rider) {
  return !(
    (rider.smoking === "吸烟" && owner.acceptsSmoking !== "接受")
    || (owner.smoking === "吸烟" && rider.acceptsSmoking !== "接受")
  );
}

function scoreMatch(owner, rider) {
  const reasons = [];
  let score = 15;
  const ownerHome = safeString(owner.home);
  const riderHome = safeString(rider.home);
  const coordinates = [owner.pickupLat, owner.pickupLng, rider.pickupLat, rider.pickupLng].map(Number);
  const hasCoordinates = coordinates.every(Number.isFinite);
  const distanceKm = hasCoordinates
    ? haversineKm(coordinates[0], coordinates[1], coordinates[2], coordinates[3])
    : null;
  const sameArea = ownerHome && riderHome
    && (ownerHome.slice(0, 3) === riderHome.slice(0, 3)
      || ownerHome.includes(riderHome.slice(0, 2))
      || riderHome.includes(ownerHome.slice(0, 2)));
  if (distanceKm != null) {
    const routeScore = distanceKm <= 3 ? 45 : distanceKm <= 8 ? 32 : distanceKm <= 15 ? 20 : 8;
    score += routeScore;
    reasons.push(`集合点相距 ${distanceKm.toFixed(1)} 公里`);
  } else if (sameArea) {
    score += 45;
    reasons.push("住所或集合路线接近");
  } else {
    score += 15;
    reasons.push("集合路线可协调");
  }
  const shared = (rider.interests || []).filter(item => (owner.interests || []).includes(item));
  if (shared.length) {
    score += Math.min(25, shared.length * 10);
    reasons.push(`共同兴趣：${shared.join("、")}`);
  }
  if (owner.roomType === rider.roomType) {
    score += 8;
    reasons.push("住宿偏好一致");
  }
  if (owner.gender && owner.gender === rider.gender) score += 7;
  reasons.push("吸烟偏好兼容");
  return { score: Math.min(100, score), reasons, distanceKm };
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const radians = value => value * Math.PI / 180;
  const latDelta = radians(lat2 - lat1);
  const lngDelta = radians(lng2 - lng1);
  const a = Math.sin(latDelta / 2) ** 2
    + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(lngDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function publicAssignment(item) {
  return {
    ...item,
    distanceKm: item.distanceKm ?? item.routeDistanceKm ?? null,
    routeDistanceKm: undefined,
    reasons: parseJsonList(item.reasons ?? item.reasonsJson),
    reasonsJson: undefined
  };
}

function buildMatchAssignments(rows, runId, previousAssignments = []) {
  const now = new Date().toISOString();
  const owners = rows.filter(row => row.role === "owner");
  const riders = rows.filter(row => row.role === "rider");
  const ownerById = new Map(owners.map(owner => [owner.id, owner]));
  const remaining = new Map(owners.map(owner => [owner.id, Math.max(0, Number(owner.seats) || 0)]));
  const previousLocked = new Map(
    previousAssignments.filter(item => item.locked).map(item => [item.riderSignupId, item])
  );
  const output = [];

  for (const rider of riders) {
    const previous = previousLocked.get(rider.id);
    const owner = previous ? ownerById.get(previous.ownerSignupId) : null;
    if (!owner || !smokingCompatible(owner, rider) || (remaining.get(owner.id) || 0) <= 0) continue;
    remaining.set(owner.id, remaining.get(owner.id) - 1);
    output.push({
      id: crypto.randomUUID(),
      matchRunId: runId,
      activityId: rider.activityId,
      ownerSignupId: owner.id,
      riderSignupId: rider.id,
      score: Number(previous.score) || 100,
      reasons: parseJsonList(previous.reasons ?? previous.reasonsJson),
      reasonsJson: JSON.stringify(parseJsonList(previous.reasons ?? previous.reasonsJson)),
      source: "manual",
      locked: true,
      createdAt: now,
      updatedAt: now
    });
  }

  for (const rider of riders) {
    if (output.some(item => item.riderSignupId === rider.id)) continue;
    const best = owners
      .filter(owner => (remaining.get(owner.id) || 0) > 0 && smokingCompatible(owner, rider))
      .map(owner => ({ owner, ...scoreMatch(owner, rider) }))
      .sort((left, right) => right.score - left.score)[0];
    if (best) remaining.set(best.owner.id, remaining.get(best.owner.id) - 1);
    const reasons = best?.reasons || ["暂无满足硬约束的空余座位"];
    output.push({
      id: crypto.randomUUID(),
      matchRunId: runId,
      activityId: rider.activityId,
      ownerSignupId: best?.owner.id || "",
      riderSignupId: rider.id,
      score: best?.score || 0,
      routeDistanceKm: best?.distanceKm == null ? null : Number(best.distanceKm.toFixed(2)),
      reasons,
      reasonsJson: JSON.stringify(reasons),
      source: "automatic",
      locked: false,
      createdAt: now,
      updatedAt: now
    });
  }
  return output;
}

async function createMatchRun(request, env, activityId) {
  if (!await isAdmin(request, env)) return json({ ok: false, message: "请先登录后台" }, 401);
  if (!env.DB?.saveMatchRun || !env.DB?.getLatestMatchRun) {
    return json({ ok: false, message: "匹配服务暂不可用" }, 503);
  }
  const rows = await signupRows(env, activityId);
  const previous = await env.DB.getLatestMatchRun(activityId);
  const run = {
    id: crypto.randomUUID(),
    activityId,
    status: "draft",
    algorithmVersion: "rules-v1",
    createdBy: "session-admin",
    createdAt: new Date().toISOString(),
    confirmedAt: ""
  };
  const assignments = buildMatchAssignments(rows, run.id, previous?.assignments || []);
  await env.DB.saveMatchRun(run, assignments);
  return json({ ...run, assignments: assignments.map(publicAssignment) }, 201);
}

async function getLatestAdminMatchRun(request, env, activityId) {
  if (!await isAdmin(request, env)) return json({ ok: false, message: "请先登录后台" }, 401);
  if (!env.DB?.getLatestMatchRun) return json({ ok: false, message: "匹配服务暂不可用" }, 503);
  const run = await env.DB.getLatestMatchRun(activityId);
  return json(run
    ? { ...run, assignments: (run.assignments || []).map(publicAssignment) }
    : { status: "empty", assignments: [] });
}

async function updateMatchAssignment(request, env, assignmentId) {
  if (!await isAdmin(request, env)) return json({ ok: false, message: "请先登录后台" }, 401);
  if (!env.DB?.getMatchRun || !env.DB?.updateMatchAssignment) {
    return json({ ok: false, message: "匹配服务暂不可用" }, 503);
  }
  const body = await request.json();
  const ownerSignupId = safeString(body.ownerSignupId, 80);
  const latestRuns = [];
  if (env.DB.getMatchRunByAssignment) {
    const direct = await env.DB.getMatchRunByAssignment(assignmentId);
    if (direct) latestRuns.push(direct);
  }
  const run = latestRuns[0];
  if (!run) return json({ ok: false, message: "匹配明细不存在" }, 404);
  if (run.status !== "draft") return json({ ok: false, message: "已确认的匹配不能调整" }, 409);
  const assignment = run.assignments.find(item => item.id === assignmentId);
  const rows = await signupRows(env, run.activityId);
  const rider = rows.find(item => item.id === assignment?.riderSignupId && item.role === "rider");
  const owner = rows.find(item => item.id === ownerSignupId && item.role === "owner");
  if (!assignment || !rider || !owner) return json({ ok: false, message: "车主或搭车成员不存在" }, 400);
  if (!smokingCompatible(owner, rider)) return json({ ok: false, message: "吸烟偏好存在硬冲突" }, 409);
  const occupied = run.assignments.filter(item => item.id !== assignment.id && item.ownerSignupId === owner.id).length;
  if (occupied >= Math.max(0, Number(owner.seats) || 0)) return json({ ok: false, message: "目标车辆已无空余座位" }, 409);
  const scored = scoreMatch(owner, rider);
  const updated = await env.DB.updateMatchAssignment({
    ...assignment,
    ownerSignupId: owner.id,
    score: scored.score,
    reasons: ["组织者人工确认", ...scored.reasons],
    reasonsJson: JSON.stringify(["组织者人工确认", ...scored.reasons]),
    source: "manual",
    locked: body.locked !== false,
    updatedAt: new Date().toISOString()
  });
  await env.DB.writeAudit?.({
    id: crypto.randomUUID(),
    adminId: "session-admin",
    action: "matches.assignment.update",
    resourceType: "match_assignment",
    resourceId: assignmentId,
    metadataJson: JSON.stringify({ ownerSignupId: owner.id, locked: body.locked !== false }),
    createdAt: new Date().toISOString()
  });
  return json(publicAssignment(updated));
}

function matchNotificationText(run, rows) {
  const byId = new Map(rows.map(row => [row.id, row]));
  const lines = run.assignments.filter(item => item.ownerSignupId).map(item => {
    const owner = byId.get(item.ownerSignupId);
    const rider = byId.get(item.riderSignupId);
    return `${rider?.name || "搭车成员"} → ${owner?.name || "车主"}（${owner?.vehicle || "车辆待确认"}）`;
  });
  return `鹿友自驾俱乐部匹配结果\n${lines.join("\n")}`;
}

async function confirmMatchRun(request, env, runId) {
  if (!await isAdmin(request, env)) return json({ ok: false, message: "请先登录后台" }, 401);
  if (!env.DB?.getMatchRun || !env.DB?.confirmMatchRun) {
    return json({ ok: false, message: "匹配服务暂不可用" }, 503);
  }
  const run = await env.DB.getMatchRun(runId);
  if (!run) return json({ ok: false, message: "匹配运行不存在" }, 404);
  const rows = await signupRows(env, run.activityId);
  const notificationText = matchNotificationText(run, rows);
  if (run.status === "confirmed") return json({ ...run, notificationText });
  if (run.status !== "draft") return json({ ok: false, message: "该匹配运行不可确认" }, 409);
  const matchedIds = new Set();
  for (const item of run.assignments) {
    if (!item.ownerSignupId) continue;
    matchedIds.add(item.ownerSignupId);
    matchedIds.add(item.riderSignupId);
  }
  const createdAt = new Date().toISOString();
  const nextNotifications = [];
  for (const row of rows.filter(item => matchedIds.has(item.id) && item.notificationConsent)) {
    const grant = row.userId
      ? await env.DB.getAcceptedSubscriptionForUser?.(row.userId, "match_confirmed")
      : null;
    const channel = grant ? "wechat_subscribe" : "in_app";
    nextNotifications.push({
      id: crypto.randomUUID(),
      activityId: run.activityId,
      signupId: row.id,
      matchRunId: run.id,
      type: "match_confirmed",
      channel,
      payloadJson: JSON.stringify({ matchRunId: run.id, templateId: grant?.templateId || "" }),
      status: "pending",
      attempts: 0,
      lastError: "",
      sentAt: "",
      dedupeKey: `${run.id}:${row.id}:match_confirmed:${channel}`,
      createdAt
    });
  }
  const confirmed = await env.DB.confirmMatchRun(run.id, createdAt, nextNotifications);
  for (const notification of nextNotifications.filter(item => item.channel === "wechat_subscribe")) {
    const row = rows.find(item => item.id === notification.signupId);
    const recipient = row?.userId ? await env.DB.getWechatRecipient?.(row.userId) : null;
    if (!recipient?.openid || typeof env.WECHAT_SUBSCRIBE_SENDER !== "function") continue;
    try {
      const payload = parseJsonList(notification.payloadJson);
      await env.WECHAT_SUBSCRIBE_SENDER({
        openid: recipient.openid,
        templateId: payload.templateId,
        page: `pages/profile/index`,
        data: {
          thing1: { value: "鹿友自驾活动" },
          phrase2: { value: "车组匹配已确认" },
          thing3: { value: "请进入小程序查看详情" }
        }
      });
      await env.DB.updateNotification?.({
        ...notification,
        status: "sent",
        attempts: 1,
        sentAt: new Date().toISOString(),
        lastError: ""
      });
    } catch (error) {
      await env.DB.updateNotification?.({
        ...notification,
        status: "failed",
        attempts: 1,
        lastError: safeString(error?.message, 300) || "微信订阅消息发送失败"
      });
    }
  }
  await env.DB.writeAudit?.({
    id: crypto.randomUUID(),
    adminId: "session-admin",
    action: "matches.confirm",
    resourceType: "match_run",
    resourceId: run.id,
    metadataJson: JSON.stringify({ activityId: run.activityId, notificationCount: nextNotifications.length }),
    createdAt
  });
  return json({ ...confirmed, notificationText });
}

function participantContact(row) {
  if (!row) return null;
  const value = {
    id: row.id,
    name: row.name,
    role: row.role,
    vehicle: row.vehicle || "",
    licensePlate: row.licensePlate || "",
    pickup: row.pickup || ""
  };
  if (row.contactConsent) {
    value.phone = row.phone;
    value.wechat = row.wechat;
  }
  return value;
}

async function getParticipantMatch(request, env, signupId) {
  if (!env.DB?.getConfirmedMatchForSignup || (!env.DB?.findSignupByCapability && !env.DB?.listSignupsByUser)) {
    return json({ ok: false, message: "匹配查询暂不可用" }, 503);
  }
  const token = bearerToken(request);
  if (!token) return json({ ok: false, message: "缺少身份凭证" }, 401);
  const user = await sessionUser(request, env);
  const userSignups = user && env.DB.listSignupsByUser
    ? await env.DB.listSignupsByUser(user.id)
    : [];
  const signup = userSignups.find(item => item.id === signupId)
    || await env.DB.findSignupByCapability?.(signupId, await sha256(token));
  if (!signup) return json({ ok: false, message: "无权查看该报名" }, 403);
  const run = await env.DB.getConfirmedMatchForSignup(signup.activityId, signup.id);
  if (!run) return json({ status: "pending" });
  const assignment = run.assignments.find(
    item => item.riderSignupId === signup.id || item.ownerSignupId === signup.id
  );
  if (!assignment?.ownerSignupId) return json({ status: "waiting" });
  const rows = await signupRows(env, signup.activityId);
  const owner = rows.find(row => row.id === assignment.ownerSignupId);
  const riders = run.assignments
    .filter(item => item.ownerSignupId === assignment.ownerSignupId)
    .map(item => rows.find(row => row.id === item.riderSignupId))
    .filter(Boolean);
  await env.DB.writeAudit?.({
    id: crypto.randomUUID(),
    adminId: `participant:${signup.id}`,
    action: "matches.contact.view",
    resourceType: "match_run",
    resourceId: run.id,
    metadataJson: JSON.stringify({ activityId: signup.activityId }),
    createdAt: new Date().toISOString()
  });
  return json({
    status: "confirmed",
    confirmedAt: run.confirmedAt,
    score: assignment.score,
    reasons: parseJsonList(assignment.reasons ?? assignment.reasonsJson),
    group: {
      owner: participantContact(owner),
      riders: riders.map(participantContact)
    }
  });
}

function createRoomPlan(rows) {
  const waiting = rows.filter(row => row.role === "rider" && row.roomType === "标间");
  const rooms = [];
  const used = new Set();
  for (const person of waiting) {
    if (used.has(person.id)) continue;
    const mate = waiting.find(other => other.id !== person.id && !used.has(other.id) && other.gender === person.gender);
    used.add(person.id);
    if (mate) used.add(mate.id);
    rooms.push({ people: mate ? [person, mate] : [person], gender: person.gender || "性别待确认" });
  }
  return rooms;
}

async function renderAdminPage(env, tab) {
  const rows = await signupRows(env);
  const owners = rows.filter(row => row.role === "owner");
  const riders = rows.filter(row => row.role === "rider");
  const groups = createGroups(rows);
  const roomPlan = createRoomPlan(rows);
  const assigned = groups.reduce((sum, group) => sum + group.people.length, 0);
  const pending = Math.max(0, riders.length - assigned);
  const scores = groups.flatMap(group => group.people.map(person => person.matchScore || 0));
  const averageScore = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;
  const tableRows = rows.length ? rows.map(row => `<tr><td><b>${escapeHtml(row.name)}</b><small>${escapeHtml(row.zodiac || "星座未填")} · ${escapeHtml(row.age || "年龄未填")}</small></td><td><b>${escapeHtml(row.phone)}</b><small>微信：${escapeHtml(row.wechat || "未填写")}</small><small>${escapeHtml(row.gender)}</small></td><td><i class="tag ${row.role === "owner" ? "owner-tag" : "rider-tag"}">${row.role === "owner" ? `车主 · ${Number(row.seats) || 0}座` : "搭车"}</i><small>${escapeHtml(row.vehicle)}</small>${row.role === "owner" ? `<small>改装：${escapeHtml([...(row.modifications || []), row.modificationOther].filter(Boolean).join("、") || "无/未填")}</small>` : ""}</td><td>${escapeHtml(row.work)}</td><td>${escapeHtml(row.home)}<small>${row.pickup ? `集合：${escapeHtml(row.pickup)}` : ""}</small></td><td>${(row.interests || []).map(item => `<i class="soft">${escapeHtml(item)}</i>`).join(" ")}<small>吸烟：${escapeHtml(row.smoking || "未填")} · 接受同行者吸烟：${escapeHtml(row.acceptsSmoking || "未填")} · 住宿：${escapeHtml(row.roomType || "单间")}</small><small>${escapeHtml(row.note)}</small></td><td><i class="${row.status === "已匹配" ? "matched" : "pending"}">${escapeHtml(row.status || "待匹配")}</i><small>定金：${escapeHtml(row.depositStatus || "待支付")}</small></td></tr>`).join("") : '<tr><td colspan="7">暂无报名资料。参与者提交后会自动显示在这里。</td></tr>';
  const convoyCards = groups.length ? groups.map((group, index) => `<article class="convoy-card"><div class="convoy-head"><b>${index + 1}号车 · ${escapeHtml(group.home || "集合点待定")}</b><span>${group.people.length ? Math.round(group.people.reduce((sum, person) => sum + person.matchScore, 0) / group.people.length) : 0}分匹配</span></div><div class="driver"><span>${escapeHtml(group.name.slice(0, 1))}</span><div><strong>${escapeHtml(group.name)}</strong><small>${escapeHtml(group.vehicle || "车辆待补充")} · ${Number(group.seats) || 0}座</small></div><em>车主</em></div><div class="passengers">${group.people.length ? group.people.map(person => `<div><i></i><b>${escapeHtml(person.name)}</b><span>${escapeHtml((person.interests || []).join("、") || "兴趣待补充")}</span><small>${person.matchScore}分</small></div>`).join("") : '<div><span>等待匹配搭车</span></div>'}</div></article>`).join("") : '<article class="panel"><b>暂无可匹配车主</b><p>车主和搭车提交报名后，系统会按居住地点、兴趣和空余座位自动分组。</p></article>';
  const vehiclePlan = groups.length ? groups.map((group, index) => `<div><b>${index + 1}号车</b><span><strong>${escapeHtml(group.name)}${group.people.length ? ` + ${group.people.map(person => escapeHtml(person.name)).join("、")}` : ""}</strong><small>${escapeHtml(group.home || "集合地点待定")} · ${escapeHtml(group.vehicle || "车辆待补充")}</small></span><em>${group.people.length}人已安排</em></div>`).join("") : '<p>暂无车组，报名后将自动生成。</p>';
  const roomRows = roomPlan.length ? `<div><b>住宿安排</b><span><strong>${roomPlan.map((room, index) => `${index + 1}号标间：${room.people.map(person => escapeHtml(person.name)).join("、")}${room.people.length === 1 ? "（等待同性伙伴）" : ""}`).join("；")}</strong><small>标间严格按同性别匹配；选择单间者不参与合住匹配</small></span><em>${roomPlan.length}间</em></div>` : "";
  const planGroups = vehiclePlan + roomRows;
  const ownerOptions = owners.map(owner => `<option value="${escapeHtml(owner.id)}">${escapeHtml(owner.name)} · ${escapeHtml(owner.vehicle || "车辆未填")} · ${Number(owner.seats) || 0}座</option>`).join("");
  const riderOptions = riders.map(rider => `<option value="${escapeHtml(rider.id)}">${escapeHtml(rider.name)} · ${escapeHtml(rider.home || "地点未填")}</option>`).join("");
  const manualEditor = riders.length && owners.length ? `<article class="panel manual-match"><div class="panel-title"><div><small>MANUAL ADJUSTMENT</small><h2>人工调整匹配</h2></div><span>自动结果可随时修改</span></div><form id="manualMatchForm"><label><span>选择搭车成员</span><select name="riderId" required><option value="">请选择</option>${riderOptions}</select></label><label><span>调整到车主</span><select name="ownerId" required><option value="">请选择</option>${ownerOptions}</select></label><button class="primary" type="submit">保存调整</button></form></article>` : `<article class="panel match-empty">暂无可匹配数据。车主和搭车成员真实报名后，系统会自动生成方案，并允许人工调整。</article>`;
  let page = PAGE.replace("<body>", '<body class="admin-app">')
    .replace('id="front" class="view active"', 'id="front" class="view"')
    .replace('id="admin" class="view"', 'id="admin" class="view active"')
    .replace('<tbody id="memberRows"></tbody>', `<tbody id="memberRows">${tableRows}</tbody>`)
    .replace('<div class="convoy-grid" id="convoyGrid"></div>', `<div class="convoy-grid" id="convoyGrid">${convoyCards}</div>`)
    .replace('<div id="manualMatchEditor"></div>', `<div id="manualMatchEditor">${manualEditor}</div>`)
    .replace('<div id="planGroups"></div>', `<div id="planGroups">${planGroups}</div>`)
    .replace('id="metricSignups">0', `id="metricSignups">${rows.length}`)
    .replace('id="metricOwners">0', `id="metricOwners">${owners.length}`)
    .replace('id="metricRiders">0', `id="metricRiders">${riders.length}`)
    .replace('id="metricSeats">0', `id="metricSeats">${owners.reduce((sum, owner) => sum + (Number(owner.seats) || 0), 0)}`)
    .replace('id="metricPending">0', `id="metricPending">${pending}`)
    .replace('id="navSignupCount">0', `id="navSignupCount">${rows.length}`)
    .replace('id="navPendingCount">0', `id="navPendingCount">${pending}`)
    .replace('id="matchAssigned">0', `id="matchAssigned">${assigned}`)
    .replace('id="matchWaiting">0', `id="matchWaiting">${pending}`)
    .replace('id="matchScore">0', `id="matchScore">${averageScore}`);
  page = page.replace(/<a class="active" href="\/admin\?tab=overview"/, '<a href="/admin?tab=overview"')
    .replace(new RegExp(`<a href="/admin\\?tab=${tab}"`), `<a class="active" href="/admin?tab=${tab}"`)
    .replace('class="admin-panel active"', 'class="admin-panel"')
    .replace(`id="${tab}Panel" class="admin-panel"`, `id="${tab}Panel" class="admin-panel active"`);
  return page;
}

export default {
  async fetch(request, env, ctx) {
    void ctx;
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (!isTrustedAdminMutation(request, env, path)) {
        return json({ ok: false, message: "请求来源校验失败" }, 403);
      }
      if (request.method === "OPTIONS" && isPublicApiPath(path)) {
        return new Response(null, { status: 204, headers: PUBLIC_CORS_HEADERS });
      }
      if (request.method === "POST" && path === "/api/v1/auth/wechat") return withPublicCors(await loginWechat(request, env));
      if (request.method === "POST" && path === "/api/v1/me/phone") return withPublicCors(await bindWechatPhone(request, env));
      if (request.method === "GET" && path === "/api/v1/me/signups") return withPublicCors(await getMySignups(request, env));
      if (request.method === "POST" && path === "/api/v1/me/subscriptions") return withPublicCors(await saveSubscription(request, env));
      if (request.method === "GET" && path === "/api/v1/me/subscriptions") return withPublicCors(await listMySubscriptions(request, env));
      if (request.method === "GET" && path === "/api/v1/me/notifications") return withPublicCors(await listMyNotifications(request, env));
      if (request.method === "POST" && path === "/api/admin/login") return login(request, env);
      if (PUBLIC_MAINTENANCE && env.TEST_MODE !== "true" && !path.startsWith("/admin") && !path.startsWith("/api/admin") && path !== "/api/health") return textResponse(CLOSED_PAGE, "text/html; charset=utf-8", 503, { "cache-control": "no-store" });
      if (request.method === "POST" && path === "/api/signup") return withPublicCors(await saveSignup(request, env));
      const activitySignupMatch = path.match(/^\/api\/v1\/activities\/([^/]+)\/signups$/);
      if (request.method === "POST" && activitySignupMatch) return withPublicCors(await saveSignup(request, env, decodeURIComponent(activitySignupMatch[1])));
      const participantMatch = path.match(/^\/api\/v1\/me\/signups\/([^/]+)\/match$/);
      if (request.method === "GET" && participantMatch) return withPublicCors(await getParticipantMatch(request, env, decodeURIComponent(participantMatch[1])));
      if (request.method === "POST" && path === "/api/signup-form") return withPublicCors(await saveSignupForm(request, env));
      if (request.method === "GET" && path === "/api/v1/activities") return withPublicCors(json(await listPublishedActivities(env)));
      const publicActivity = path.match(/^\/api\/v1\/activities\/([^/]+)$/);
      if (request.method === "GET" && publicActivity) {
        const value = await listPublishedActivities(env, decodeURIComponent(publicActivity[1]));
        return withPublicCors(value ? json(value) : json({ ok: false, message: "活动不存在" }, 404));
      }
      const publicPosts = path.match(/^\/api\/v1\/activities\/([^/]+)\/posts$/);
      if (request.method === "GET" && publicPosts) return withPublicCors(await listPublishedPosts(env, decodeURIComponent(publicPosts[1]), safeString(url.searchParams.get("type"), 30)));
      if (request.method === "GET" && path === "/api/v1/admin/activities") return await isAdmin(request, env) ? json(await env.DB.listAdminActivities?.() || []) : json({ ok: false, message: "请先登录后台" }, 401);
      if (request.method === "POST" && path === "/api/v1/admin/activities") return saveActivityDraft(request, env);
      const adminActivity = path.match(/^\/api\/v1\/admin\/activities\/([^/]+)$/);
      if (request.method === "PUT" && adminActivity) return saveActivityDraft(request, env, decodeURIComponent(adminActivity[1]));
      const activityPublish = path.match(/^\/api\/v1\/admin\/activities\/([^/]+)\/(publish|unpublish)$/);
      if (request.method === "POST" && activityPublish) return publishActivity(request, env, decodeURIComponent(activityPublish[1]), activityPublish[2] === "unpublish");
      if (request.method === "POST" && path === "/api/v1/admin/posts") return savePostDraft(request, env);
      if (request.method === "POST" && path === "/api/v1/admin/content/generations") return generateContentLayouts(request, env);
      const adminPost = path.match(/^\/api\/v1\/admin\/posts\/([^/]+)$/);
      if (request.method === "PUT" && adminPost) return savePostDraft(request, env, decodeURIComponent(adminPost[1]));
      const postPublish = path.match(/^\/api\/v1\/admin\/posts\/([^/]+)\/publish$/);
      if (request.method === "POST" && postPublish) return publishPost(request, env, decodeURIComponent(postPublish[1]));
      if (request.method === "POST" && path === "/api/admin/content") return saveContent(request, env);
      if (request.method === "POST" && path === "/api/admin/media") return await uploadMedia(request, env);
      if (request.method === "POST" && path === "/api/v1/admin/media") return await uploadMedia(request, env, true);
      if (request.method === "POST" && path === "/api/admin/match") return saveManualMatch(request, env);
      if (request.method === "GET" && path === "/api/signups") return await isAdmin(request, env) ? listSignups(env) : json({ message: "请先登录后台" }, 401);
      const signupExportMatch = path.match(/^\/api\/v1\/admin\/activities\/([^/]+)\/signups\/export\.csv$/);
      if (request.method === "GET" && signupExportMatch) return exportSignups(request, env, decodeURIComponent(signupExportMatch[1]));
      const activityDashboard = path.match(/^\/api\/v1\/admin\/activities\/([^/]+)\/dashboard$/);
      if (request.method === "GET" && activityDashboard) return getActivityDashboard(request, env, decodeURIComponent(activityDashboard[1]));
      const signupLifecycle = path.match(/^\/api\/v1\/admin\/signups\/([^/]+)\/lifecycle$/);
      if (request.method === "POST" && signupLifecycle) return updateSignupLifecycle(request, env, decodeURIComponent(signupLifecycle[1]));
      const matchRunCreate = path.match(/^\/api\/v1\/admin\/activities\/([^/]+)\/matches\/runs$/);
      if (request.method === "POST" && matchRunCreate) return createMatchRun(request, env, decodeURIComponent(matchRunCreate[1]));
      if (request.method === "GET" && matchRunCreate) return getLatestAdminMatchRun(request, env, decodeURIComponent(matchRunCreate[1]));
      const matchAssignmentUpdate = path.match(/^\/api\/v1\/admin\/matches\/assignments\/([^/]+)$/);
      if (request.method === "PUT" && matchAssignmentUpdate) return updateMatchAssignment(request, env, decodeURIComponent(matchAssignmentUpdate[1]));
      const matchRunConfirm = path.match(/^\/api\/v1\/admin\/matches\/runs\/([^/]+)\/confirm$/);
      if (request.method === "POST" && matchRunConfirm) return confirmMatchRun(request, env, decodeURIComponent(matchRunConfirm[1]));
      if (request.method === "GET" && path === "/api/stats") { const rows = await signupRows(env); const owners = rows.filter(row => row.role === "owner"); const riders = rows.filter(row => row.role === "rider"); return withPublicCors(json({ signups: rows.length, vehicles: owners.length, seats: Math.max(0, owners.reduce((sum, owner) => sum + (Number(owner.seats) || 0), 0) - riders.length) })); }
      if (request.method === "GET" && path === "/api/content") return withPublicCors(json(await getContent(env)));
      if (request.method === "GET" && path === "/api/activities") { const activity = url.searchParams.get("id"); const value = await getActivities(env, activity || ""); return withPublicCors(activity && !value ? json({ message: "活动不存在" }, 404) : json(value)); }
      if (request.method === "GET" && path === "/api/health") return withPublicCors(json({ ok: true }));
      if (request.method === "GET" && path === "/club-interactions") return textResponse(APP_JS, "application/javascript; charset=utf-8", 200, { "cache-control": "no-store" });
      if (path === "/admin" || path === "/admin/") {
        if (!await isAdmin(request, env)) return textResponse(LOGIN_PAGE.replace("{{ERROR}}", ""), "text/html; charset=utf-8");
        const tab = ["overview", "matches", "recap", "plan"].includes(url.searchParams.get("tab")) ? url.searchParams.get("tab") : "overview";
        return textResponse(await renderAdminPage(env, tab), "text/html; charset=utf-8", 200, { "cache-control": "no-store" });
      }
      if (request.method !== "GET" && request.method !== "HEAD") return textResponse("Method not allowed", "text/plain; charset=utf-8", 405);
      if (["/", "/index.html", "/journey", "/trip", "/signup", "/submitted"].includes(path)) return textResponse(renderPage(path, url), "text/html; charset=utf-8", 200, { "cache-control": "no-store" });
      if (path === "/styles.css") return textResponse(CSS, "text/css; charset=utf-8", 200, { "cache-control": "public, max-age=86400" });
      if (path === "/app.js") return textResponse(APP_JS, "application/javascript; charset=utf-8", 200, { "cache-control": "public, max-age=300" });
      if (path === "/assets/deer-club.png") return textResponse(decodeBase64(LOGO), "image/png", 200, { "cache-control": "public, max-age=604800" });
      if (path === "/assets/zhangbei-hero.png") return textResponse(decodeBase64(HERO), "image/png", 200, { "cache-control": "public, max-age=604800" });
      if (path === "/assets/deposit-qr.jpg") return textResponse(decodeBase64(DEPOSIT_QR), "image/jpeg", 200, { "cache-control": "public, max-age=604800" });
      return textResponse("Not found", "text/plain; charset=utf-8", 404);
    } catch (error) {
      console.error("Request failed", error);
      if (path === "/api/admin/media") return json({ ok: false, message: safeString(error?.message, 300) || "媒体上传失败" }, 500);
      const response = path.startsWith("/api/") ? json({ ok: false, message: "服务暂时繁忙，请稍后再试" }, 500) : textResponse("服务暂时繁忙", "text/plain; charset=utf-8", 500);
      return isPublicApiPath(path) ? withPublicCors(response) : response;
    }
  }
};
