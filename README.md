# 鹿友自驾俱乐部

鹿友自驾俱乐部是一套面向自驾活动组织与报名的全链路系统，包含 H5 报名页、组织者后台、CloudBase HTTP 服务、数据库迁移、匹配与通知能力，以及微信小程序参与者端。

## 功能范围

- 多活动发布、下线、报名隔离和 CSV 导出
- 报名资料、车辆信息、定金状态、兴趣偏好和集合点采集
- 车主与搭车成员自动匹配、人工调整、确认发布和报名者查询
- 微信小程序登录、手机号绑定、我的报名、匹配结果和订阅通知
- 运营看板、候补、退款、签到、媒体上传与结构化排版
- 本地开发 mock 数据与正式线上 CloudBase API 自动切换

## 目录结构

```text
.
├── site/                         # H5 报名页与组织者后台前端
├── worker/                       # Cloudflare/CloudBase 兼容 Worker 模板
├── cloudbase/                    # CloudBase HTTP 服务部署包源码
├── drizzle/                      # SQLite/D1 数据库迁移
├── db/                           # Drizzle schema
├── miniapp/                      # Taro 微信小程序源码
├── release/                      # 构建生成的交付目录
├── scripts/                      # 构建、测试和契约验证脚本
├── server.py                     # 早期本地静态/报名服务
└── 鹿友自驾俱乐部研发方案.md
```

## 小程序数据源

小程序源码位于 `miniapp/`。数据源由 `miniapp/src/services/api.ts` 自动判断：

- 开发版、体验版、微信开发者工具：使用 `miniapp/src/services/localMock.ts` 的本地 mock DB，写入小程序本地 storage。
- 正式版：请求线上 CloudBase API。

线上 API：

```text
https://luyouclub-2026-d5gium2fuf59427be-1487080718.ap-shanghai.app.tcloudbase.com
```

本地 mock storage key：

```text
luyou.mock.activities
luyou.mock.signups
luyou.mock.dbVersion
```

微信开发者工具导入目录：

```text
/Users/bytedance/luyou/鹿友自驾俱乐部/miniapp
```

`miniapp/project.config.json` 的 `miniprogramRoot` 指向 `dist/`。源码变更后需要重新构建 `dist`。

## 本地后台

本地 CloudBase 兼容后台：

```bash
node scripts/build-cloudbase.mjs
LOCAL_FILE_DB=1 PORT=9000 ADMIN_PASSWORD=test-password ADMIN_SESSION_SECRET=test-secret-that-is-long-enough-123456 node release/luyouclub-cloudbase/server.cjs
```

访问：

```text
http://localhost:9000/admin
```

本地测试密码：

```text
test-password
```

## 常用命令

```bash
# 构建 CloudBase 交付包
node scripts/build-cloudbase.mjs

# 构建小程序源码交付包
node scripts/build-miniapp.mjs

# 生成微信小程序 dist
cd miniapp && ./node_modules/.bin/taro build --type weapp

# 微信小程序 watch 构建
cd miniapp && ./node_modules/.bin/taro build --type weapp --watch

# 全量测试
npm test
```

## 验证

项目已覆盖以下验证：

- 数据库迁移测试：`python3 scripts/test-migrations.py`
- CloudBase 数据契约：`node scripts/test-cloudbase-data-contract.mjs`
- H5 流程验证：`node scripts/verify-flow.mjs`
- CloudBase 服务测试：`node scripts/test-cloudbase.mjs`
- 阶段 1-5 专项测试：`node scripts/test-stage*.mjs`
- 小程序契约与交付检查：`node miniapp/tests/project-contract.mjs`、`node scripts/test-miniapp-delivery.mjs`

## 上线注意事项

- 在 CloudBase 数据库执行 `drizzle/0000` 至 `drizzle/0008` 迁移。
- 配置 `ADMIN_PASSWORD`、`ADMIN_SESSION_SECRET`、`CLOUDBASE_ENV_ID`、`CLOUDBASE_APIKEY`、`WECHAT_APP_ID`、`WECHAT_APP_SECRET`。
- 在微信公众平台配置合法 request/download 域名。
- 正式版小程序会自动走线上 API；开发版和体验版会走本地 mock DB。
