# 复制给 WorkBuddy 的完整指令

请把我上传的 `luyouclub-cloudbase` 项目部署到我的腾讯云 CloudBase 环境。不要重新设计页面，不要删除现有功能，不要把它改成纯静态网站。

部署目标：

1. 使用上海地域 CloudBase。
2. 创建关系型数据库表 `signups`、`clubContent`、`matchOverrides`，权限必须是仅服务端/管理员读写；为 `signups.phone`、`clubContent.id`、`matchOverrides.riderId` 配置唯一约束。
3. 创建私有对象存储桶 `club-media`，用于活动照片、视频和 `activity-feed.json`。
4. 将本项目部署为 Node.js 18+ HTTP 云函数，启动命令由 `scf_bootstrap` 执行，服务监听端口9000。
5. 安装 package.json 中的依赖。
6. 向我索取并配置 `ADMIN_PASSWORD`；自动生成至少32位的 `ADMIN_SESSION_SECRET`，不要把密钥写入源码。
7. 配置 `CLOUDBASE_ENV_ID` 和安全的 `CLOUDBASE_APIKEY`。不要在日志或聊天中显示完整 APIKey。
8. 在 CloudBase“HTTP访问服务”中配置根路径 `/` 指向该HTTP云函数，开启路径透传。
9. 依次验证 `/api/health`、`/`、`/trip`、`/signup?role=owner`、`/signup?role=rider` 和 `/admin`。
10. 分别提交一条测试车主与测试乘客资料，确认支付二维码、200元定金确认、退款规则、车辆改装多选与自由填写均可使用；确认后台能看到定金“待核验”、车辆改装资料并自动生成匹配结果；测试完成后删除测试数据。
11. 验证活动草稿、正式发布、媒体上传和人工匹配调整，确认重新部署后数据仍然存在。
12. 先返回腾讯云测试地址供验收。`luyouclub.site` 尚未完成ICP备案前，不要修改正式域名DNS。

验收标准：手机页面可点击进入行程、选择车主或乘客、完整提交；支付二维码清晰可扫码，车主和乘客都必须确认200元定金及退款规则；车主改装多选和其他改装可保存；吸烟偏好、房型和备注能保存；后台密码登录可用；全部报名资料、定金状态、车组匹配和行动方案均可见；刷新或重新部署后数据库数据不会丢失。
