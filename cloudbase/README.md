# 鹿友自驾俱乐部 · 腾讯云 CloudBase 部署包

这是可以直接部署到腾讯云 CloudBase HTTP 云函数的完整版本，包含参与者页面、200元定金二维码、车辆改装资料、报名表、组织者后台、数据库保存及自动匹配。

## 功能入口

- 参与者：`/`
- 行程手册：`/trip`
- 车主报名：`/signup?role=owner`
- 乘客报名：`/signup?role=rider`
- 组织者后台：`/admin`
- 健康检查：`/api/health`

## 腾讯云部署要求

1. 创建上海地域 CloudBase 环境。
2. 按 `drizzle/0000` 至最新迁移在 CloudBase 关系型数据库创建对应驼峰命名表，并设为仅服务端访问。
3. 至少配置 `signups(activityId,phone)`、`matchAssignments(matchRunId,riderSignupId)`、`participantCapabilities(activityId,signupId)`、`notifications.dedupeKey`、`posts(activityId,type,version)` 的唯一约束。
4. 创建私有对象存储桶 `club-media`，或授予云函数首次上传时创建该存储桶的权限。
5. 创建 Node.js 18 或更高版本的 HTTP 云函数，监听端口 `9000`。
6. 上传本目录全部文件并安装 `package.json` 依赖。
7. 配置环境变量：`ADMIN_PASSWORD`、`ADMIN_SESSION_SECRET`、`CLOUDBASE_ENV_ID`、`CLOUDBASE_APIKEY`、`WECHAT_APP_ID`、`WECHAT_APP_SECRET`。
8. 在 HTTP 访问服务中开启“路径透传”，将根路径 `/` 关联到此 HTTP 云函数。
9. 用腾讯云测试域名检查 `/api/health`、报名提交及 `/admin`。
10. ICP 备案完成后再绑定 `luyouclub.site`。

## 数据资源

- `activities`、`posts`：活动草稿、公开状态和不可变发布版本。
- `signups`、`participantCapabilities`：分活动报名与 H5 私密查询凭证。
- `matchRuns`、`matchAssignments`：匹配草案、人工锁定和确认版本。
- `notifications`、`auditLogs`：站内通知队列与敏感操作审计。
- `mediaAssets`、`postMedia`：私有媒体元数据、文章引用和展示顺序。
- `users`、`wechatIdentities`、`userSessions`、`subscriptionGrants`：微信身份、服务端会话和订阅授权。
- `signupLocations`、`signupOperations`：集合坐标以及候补、退款、签到操作记录。
- `contentGenerations`：结构化内容与三套排版方案的生成记录。
- `clubContent`、`matchOverrides` 与 `activity-feed.json`：仅用于旧版本兼容迁移，不再作为新功能主数据。
- `club-media`：私有媒体存储桶；客户端只使用服务端生成的短期签名地址。

缺少任一数据库表时，报名列表、活动发布或人工匹配会返回服务错误。部署前应先完成资源初始化，再执行流程验证。

## 本机运行

```bash
npm install
LOCAL_FILE_DB=1 ADMIN_PASSWORD='test-password' ADMIN_SESSION_SECRET='please-change-this-local-secret' npm start
```

浏览器打开 `http://localhost:9000`。本机报名保存在 `/tmp/luyouclub-signups.json`，匹配、发布和通知数据保存在 `/tmp/luyouclub-matches.json`。

## 安全要求

- 正式部署不得使用示例密码。
- `ADMIN_SESSION_SECRET` 至少32位随机字符。
- 不要把 APIKey、密码写入代码或发到聊天截图中。
- 数据库表和 `club-media` 存储桶不得开放客户端直接写入，所有变更必须经过服务器。
- 微信密钥只配置在云函数环境变量中；小程序端仅保存短期业务会话。
- 可选的 `MEDIA_ANALYSIS_ENDPOINT` 必须使用 HTTPS，并通过 `MEDIA_ANALYSIS_TOKEN` 鉴权。
