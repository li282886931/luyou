# 鹿友自驾俱乐部小程序端

基于 Taro 4、React 和 TypeScript 构建的微信小程序参与者端，与现有网页后台共用腾讯云 CloudBase 数据和 HTTP API。

## 页面

- 首页：品牌信息、活动数据和报名入口。
- 活动：已发布活动列表。
- 我的：本机最近一次报名及真实匹配状态。
- 活动详情：路线、时间线、注意事项和报名入口。
- 活动报名：车主或搭车伙伴的完整三步报名流程。

## 数据连接

微信小程序的数据源由 `src/services/api.ts` 按运行环境自动切换：

- 开发版、体验版和开发者工具：使用 `src/services/localMock.ts` 的本地 mock DB，数据写入小程序本地 storage，覆盖首页、活动、详情、报名和我的页面。
- 正式版：请求线上 CloudBase HTTP API，活动、统计、报名、登录、我的报名和匹配结果全部走真实云端数据。

微信小程序发布前，需要在当前 IDE 的预览与发布页面配置小程序 AppID，并将以下域名加入小程序合法请求和下载域名：

```text
https://luyouclub-2026-d5gium2fuf59427be-1487080718.ap-shanghai.app.tcloudbase.com
```

小程序端不直接访问数据库，也不包含后台密码、APIKey 或 CloudBase 服务端密钥。

## 交付

项目根目录的交付脚本会将完整源码复制到：

```text
release/luyouclub-miniapp/
```

预览、二维码、上传和发布统一通过当前 IDE 的小程序预览能力完成。
