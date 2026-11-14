# Netlify Vertex 文本聊天接入

本次以 dev/personal-features 的 0eb7243780225530b4b0c23aea1b7bd0f3caf8cf 为基线。新增聊天和模型列表后端，保留现有 Custom、角色卡、世界书及聊天组装逻辑。尚未部署，也没有使用真实 Google 凭据测试。

在 Netlify 的生产运行时环境变量中设置 GOOGLE_SERVICE_ACCOUNT_JSON（完整服务账号 JSON）、GOOGLE_CLOUD_PROJECT（项目 ID）、GOOGLE_CLOUD_LOCATION（已验证的位置，默认 global）、VERTEX_MODEL（已验证的完整 google/gemini-... 模型 ID）和 VERTEX_PROXY_TOKEN（独立随机令牌，至少 32 字符）。这些变量不能使用 NEXT_PUBLIC_ 前缀。JSON 中的私钥保留 JSON 转义格式；不要把 JSON 上传到仓库。重新部署后环境变量才会进入新函数版本。预览部署使用单独凭据，避免给不可信预览开放生产密钥。

可在自己的终端运行 node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" 生成代理令牌。Google 凭据仅在服务器使用；网页 API Key 填的是代理令牌。网页会保存该令牌，因此只适合可信的个人浏览器，不要分享含它的配置导出文件。未配置或错误令牌均拒绝访问，即使启用了自部署模式也不例外。

部署获批准之后，在应用 API 配置中选择 Custom，Base URL 填 https://你的域名/api/vertex/v1，API Key 填 VERTEX_PROXY_TOKEN，模型填 VERTEX_MODEL 同样的值。点击拉取模型，然后测试连接。先关闭原生工具、图片识别及图片生成；本版本会明确拒绝工具和非文本消息。将此 API 方案绑定到需要的角色或全局默认。

每个请求最多 1 MiB、500 条消息、8192 输出 token（未指定时 4096），temperature 范围 0–2，top_p 范围 0–1。仅转发这些生成参数，其他采样参数不透传。不要将这些限制理解为 Google 的模型能力上限。首次测试可使用短提示词及较低输出上限。

流式和非流式都支持，SSE 原样转发，取消会中止上游，不自动重试。上游调用在 55 秒后中止；Netlify 实际部署仍需验证流式到达和平台时限。实例内限制为每分钟 20 次、同时 2 次，属于尽力保护，不是跨实例限流或硬性消费预算。对外多人服务之前应增加持久化用量控制和逐用户认证。预算提醒不是硬性止付。

验收时先确认错误令牌返回 401，再检查模型列表、非流式测试、流式逐段到达、取消、超过时限的提示以及角色卡/世界书/历史上下文。测试模型不在白名单、请求过大、错误 JSON 和工具消息均被拒绝。浏览器网络中不应出现 Google 私钥或 OAuth token。Google 的错误正文不会直接返回客户端。

赠金资格及实际抵扣需要在 Cloud Billing 中单独检查，API 成功不代表赠金抵扣。不会自动切换到其他付费模型。离线推送和微信独立助手尚未验证，不在这次接入范围。

本地审阅补丁可用 git apply --check vertex-netlify.patch，确认基线后再 git apply vertex-netlify.patch。安装依赖使用 npm ci，然后进行项目类型检查与构建。回滚优先恢复此前的 Netlify 部署，并撤销代理令牌、停用不再需要的服务账号密钥。
