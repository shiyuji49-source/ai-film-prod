# 鎏光机（ai-film-prod）项目恢复 TODO

## 恢复任务

- [x] 解压并分析源码结构
- [x] 初始化新的 Web App 脚手架
- [x] 迁移 package.json、配置文件和依赖
- [x] 迁移 drizzle schema、server 代码
- [x] 迁移 client 前端代码
- [x] 执行数据库迁移 SQL
- [x] 导入用户数据
- [x] 配置 API 密钥（VectorEngine、ARK）
- [x] 验证项目运行
- [x] 保存检查点

## 功能模块

- [x] 用户认证系统（OAuth）
- [ ] 积分系统
- [x] 项目管理（CRUD）
- [x] 剧本解析（Excel/Word/TXT）
- [x] 分镜管理
- [x] 视频生成（多引擎：Seedance 1.5 Pro / Kling 3.0 / Veo 3.1）
- [x] 资产库管理
- [x] 图片生成（多引擎：Seedream 4.5/5.0 / MJ / Gemini 3 Pro）
- [ ] Stripe 支付集成
- [ ] 管理后台
- [x] S3 文件存储
- [x] LLM 智能辅助（AI 制作顾问 + 提示词生成）
- [ ] 通知系统

## Bug 修复

- [x] 修复 overseas_projects 表缺少 aspectRatio、genre、totalEpisodes、status 字段导致的查询错误

## 2026-03-19 大重构

- [x] 后端 LLM 改为 invokeLLM（统一调用，无需手动配置模型）
- [x] 图片模型精简：MJ（VectorEngine）+ doubao-seedream-4-5 + doubao-seedream-5-0（火山引擎）+ nano-banana-pro（Gemini 3 Pro Image）
- [x] 视频模型只保留 doubao-seedance-1-5-pro（火山引擎）为默认，保留 Kling/Veo 可选
- [x] 资产库角色：目标市场支持中国(🇨🇳)/西班牙(🇪🇸)等10个市场
- [x] 资产库角色：三个按钮合并为「一键全流程」（风格定调 → 多视角）+ 步骤进度指示
- [x] 资产库角色：风格定调只保留 MJ 和即梦 4.5，中国市场默认即梦4.5，其他默认MJ
- [x] 资产库角色：多视角改为角色四视角（近景主视图+正/侧/背面全身）
- [x] 资产库角色：风格定调和多视角支持 ←→ 翻页历史（HistoryPaginator），有图时显示「重新生成」
- [x] 资产库场景：多角度九宫格（16:9 横屏）
- [x] 所有生成主体保存到主体库，首帧生成面板一键调用（快速添加主体参考）
- [x] 故事版首帧显示修复：竖屏 9:16，横屏 16:9（imageEngine 默认 Seedream 4.5）
- [x] 视频生成只保留 doubao-seedance-1-5-pro 为默认
- [x] MARKET_OPTIONS 从 shared/videoModels.ts 统一导出，前后端共用

## 2026-03-19 全面优化（跑量剧工作流）

- [x] 端到端全链路跑通测试（65 个测试全部通过）
- [x] 所有页面添加返回键/导航（ProjectWorkspace 头部有返回键）
- [x] 加载状态和错误提示优化（所有生成操作有 loading 状态和 toast 提示）
- [x] 主体库一键调用到首帧生成面板（快速添加主体参考图）
- [x] 批量跑量流程优化（BatchRunDialog：支持 mode/视频引擎/时长选择）
- [x] batchRun 支持 mode 参数（image/video/both）
- [x] 提示词质量优化（generateFrame/batchRun/autoGeneratePrompts 针对 Seedream 4.5 和 Seedance 1.5 Pro 优化）
- [x] 首尾帧最佳实践（首帧=开场构图/情绪建立，尾帧=情绪高潮/转场前最后一帧）
- [x] generateFrame 支持 imageEngine 参数（Seedream 4.5/5.0 vs VE Gemini 3 Pro Image）
- [x] generateMultiView 使用 Seedream 5.0 生成多视角
- [x] generateAssetImage 默认模型改为 Seedream 4.5
- [x] chatWithLLM 使用 invokeLLM（AI 制作顾问真实接入）
- [x] LLMChatPanel 完全重写（真实 AI 对话，快速提问按钮，消息历史）
- [x] autoGeneratePrompts 返回值字段名修复（imagePrompts/videoPrompts）
- [x] IMAGE_MODELS 添加 nano-banana-pro（Gemini 3 Pro Image）
- [x] MARKET_OPTIONS 添加中国(🇨🇳)和西班牙(🇪🇸)
- [x] imageEngine 默认值修复（doubao-seedream-4-5-251128）
- [x] 新增 overseas.workflow.test.ts（24 个专项测试）
