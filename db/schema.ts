import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const signups = sqliteTable("signups", {
  id: text("id").primaryKey(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  status: text("status").notNull().default("待匹配"),
  signupStatus: text("signup_status").notNull().default("已报名"),
  activityId: text("activity_id").notNull().default("legacy-main"),
  userId: text("user_id"),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  wechat: text("wechat"),
  role: text("role").notNull(),
  gender: text("gender"),
  age: text("age"),
  zodiac: text("zodiac"),
  work: text("work").notNull(),
  home: text("home").notNull(),
  pickup: text("pickup"),
  vehicle: text("vehicle"),
  licensePlate: text("license_plate"),
  seats: integer("seats").notNull().default(0),
  note: text("note"),
  smoking: text("smoking").notNull().default("不吸烟"),
  acceptsSmoking: text("accepts_smoking").notNull().default("不接受"),
  roomType: text("room_type").notNull().default("单间"),
  modificationsJson: text("modifications_json").notNull().default("[]"),
  modificationOther: text("modification_other"),
  depositStatus: text("deposit_status").notNull().default("待支付"),
  interestsJson: text("interests_json").notNull().default("[]"),
  assignedOwnerId: text("assigned_owner_id"),
  contactConsent: integer("contact_consent", { mode: "boolean" }).notNull().default(false),
  notificationConsent: integer("notification_consent", { mode: "boolean" }).notNull().default(false)
}, table => ({
  activityPhoneUnique: uniqueIndex("signups_activity_phone_unique").on(table.activityId, table.phone),
  activityIndex: index("signups_activity_id_idx").on(table.activityId),
  assignedOwnerIndex: index("signups_assigned_owner_id_idx").on(table.assignedOwnerId)
}));

export const activities = sqliteTable("activities", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  dateText: text("date_text").notNull(),
  startAt: text("start_at"),
  endAt: text("end_at"),
  route: text("route").notNull(),
  timelineJson: text("timeline_json").notNull().default("[]"),
  notice: text("notice").notNull().default(""),
  summary: text("summary").notNull().default(""),
  coverUrl: text("cover_url").notNull().default(""),
  mediaJson: text("media_json").notNull().default("[]"),
  status: text("status").notNull().default("draft"),
  signupOpen: integer("signup_open", { mode: "boolean" }).notNull().default(true),
  capacity: integer("capacity").notNull().default(0),
  publishedVersion: integer("published_version").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  publishedAt: text("published_at")
}, table => ({
  statusPublishedIndex: index("activities_status_published_at_idx").on(table.status, table.publishedAt)
}));

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  adminId: text("admin_id").notNull(),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id").notNull(),
  metadataJson: text("metadata_json").notNull().default("{}"),
  createdAt: text("created_at").notNull()
}, table => ({
  resourceIndex: index("audit_logs_resource_idx").on(table.resourceType, table.resourceId, table.createdAt)
}));

export const matchRuns = sqliteTable("match_runs", {
  id: text("id").primaryKey(),
  activityId: text("activity_id").notNull(),
  status: text("status").notNull().default("draft"),
  algorithmVersion: text("algorithm_version").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  confirmedAt: text("confirmed_at")
}, table => ({
  activityStatusIndex: index("match_runs_activity_status_idx").on(table.activityId, table.status, table.createdAt)
}));

export const matchAssignments = sqliteTable("match_assignments", {
  id: text("id").primaryKey(),
  matchRunId: text("match_run_id").notNull(),
  activityId: text("activity_id").notNull(),
  ownerSignupId: text("owner_signup_id").notNull().default(""),
  riderSignupId: text("rider_signup_id").notNull(),
  score: integer("score").notNull().default(0),
  routeDistanceKm: real("route_distance_km"),
  reasonsJson: text("reasons_json").notNull().default("[]"),
  source: text("source").notNull().default("automatic"),
  locked: integer("locked", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
}, table => ({
  runRiderUnique: uniqueIndex("match_assignments_run_rider_unique").on(table.matchRunId, table.riderSignupId),
  activityOwnerIndex: index("match_assignments_activity_owner_idx").on(table.activityId, table.ownerSignupId)
}));

export const participantCapabilities = sqliteTable("participant_capabilities", {
  id: text("id").primaryKey(),
  activityId: text("activity_id").notNull(),
  signupId: text("signup_id").notNull(),
  tokenHash: text("token_hash").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
}, table => ({
  activitySignupUnique: uniqueIndex("participant_capabilities_activity_signup_unique").on(table.activityId, table.signupId),
  tokenHashUnique: uniqueIndex("participant_capabilities_token_hash_unique").on(table.tokenHash)
}));

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  activityId: text("activity_id").notNull(),
  signupId: text("signup_id").notNull(),
  matchRunId: text("match_run_id").notNull(),
  type: text("type").notNull(),
  channel: text("channel").notNull().default("in_app"),
  payloadJson: text("payload_json").notNull().default("{}"),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  sentAt: text("sent_at"),
  dedupeKey: text("dedupe_key").notNull(),
  createdAt: text("created_at").notNull()
}, table => ({
  dedupeKeyUnique: uniqueIndex("notifications_dedupe_key_unique").on(table.dedupeKey),
  signupCreatedIndex: index("notifications_signup_created_idx").on(table.signupId, table.createdAt)
}));

export const posts = sqliteTable("posts", {
  id: text("id").primaryKey(),
  activityId: text("activity_id").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  contentJson: text("content_json").notNull().default("{}"),
  status: text("status").notNull().default("draft"),
  version: integer("version").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  publishedAt: text("published_at")
}, table => ({
  activityTypeVersionUnique: uniqueIndex("posts_activity_type_version_unique").on(table.activityId, table.type, table.version),
  activityStatusPublishedIndex: index("posts_activity_status_published_idx").on(table.activityId, table.status, table.publishedAt)
}));

export const mediaAssets = sqliteTable("media_assets", {
  id: text("id").primaryKey(),
  activityId: text("activity_id").notNull(),
  storagePath: text("storage_path").notNull(),
  name: text("name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull().default(0),
  status: text("status").notNull().default("uploaded"),
  focusX: real("focus_x").notNull().default(0.5),
  focusY: real("focus_y").notNull().default(0.5),
  coverScore: integer("cover_score").notNull().default(0),
  cropSuggestionsJson: text("crop_suggestions_json").notNull().default("[]"),
  createdAt: text("created_at").notNull()
}, table => ({
  activityStatusIndex: index("media_assets_activity_status_idx").on(table.activityId, table.status, table.createdAt)
}));

export const postMedia = sqliteTable("post_media", {
  postId: text("post_id").notNull(),
  mediaAssetId: text("media_asset_id").notNull(),
  role: text("role").notNull().default("gallery"),
  sortOrder: integer("sort_order").notNull().default(0)
}, table => ({
  postMediaUnique: uniqueIndex("post_media_post_media_unique").on(table.postId, table.mediaAssetId),
  postOrderIndex: index("post_media_post_order_idx").on(table.postId, table.sortOrder)
}));

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  phone: text("phone"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
}, table => ({
  phoneIndex: index("users_phone_idx").on(table.phone)
}));

export const wechatIdentities = sqliteTable("wechat_identities", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  openid: text("openid").notNull(),
  unionid: text("unionid"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
}, table => ({
  openidUnique: uniqueIndex("wechat_identities_openid_unique").on(table.openid),
  userIndex: index("wechat_identities_user_id_idx").on(table.userId)
}));

export const userSessions = sqliteTable("user_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  tokenHash: text("token_hash").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull()
}, table => ({
  tokenHashUnique: uniqueIndex("user_sessions_token_hash_unique").on(table.tokenHash),
  userExpiresIndex: index("user_sessions_user_expires_idx").on(table.userId, table.expiresAt)
}));

export const subscriptionGrants = sqliteTable("subscription_grants", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  templateId: text("template_id").notNull(),
  status: text("status").notNull(),
  templateVersion: text("template_version").notNull().default(""),
  grantedAt: text("granted_at"),
  updatedAt: text("updated_at").notNull()
}, table => ({
  userTemplateUnique: uniqueIndex("subscription_grants_user_template_unique").on(table.userId, table.templateId),
  statusIndex: index("subscription_grants_status_idx").on(table.status, table.updatedAt)
}));

export const signupLocations = sqliteTable("signup_locations", {
  signupId: text("signup_id").primaryKey(),
  activityId: text("activity_id").notNull(),
  homeLat: real("home_lat"),
  homeLng: real("home_lng"),
  pickupLat: real("pickup_lat"),
  pickupLng: real("pickup_lng"),
  updatedAt: text("updated_at").notNull()
}, table => ({
  activityIndex: index("signup_locations_activity_idx").on(table.activityId)
}));

export const signupOperations = sqliteTable("signup_operations", {
  id: text("id").primaryKey(),
  activityId: text("activity_id").notNull(),
  signupId: text("signup_id").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull(),
  amount: integer("amount").notNull().default(0),
  note: text("note").notNull().default(""),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull()
}, table => ({
  activityTypeIndex: index("signup_operations_activity_type_idx").on(table.activityId, table.type, table.createdAt)
}));

export const contentGenerations = sqliteTable("content_generations", {
  id: text("id").primaryKey(),
  activityId: text("activity_id").notNull(),
  inputJson: text("input_json").notNull(),
  variantsJson: text("variants_json").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull()
}, table => ({
  activityIndex: index("content_generations_activity_idx").on(table.activityId, table.createdAt)
}));
