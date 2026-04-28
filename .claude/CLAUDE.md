# 鎏光机 AI 影视制作系统 — 废才 Agent Teams

> 制片人调度系统，支持精品剧和跑量剧双线路工作流。
> Resumable Subagents 架构，带审核工作流。

---

## 项目信息

- **项目名称**：鎏光机 (ai-film-prod)
- **技术栈**：React 19 + tRPC + Express + Drizzle ORM + MySQL
- **LLM**：Claude Sonnet 4.6（通过 VectorEngine 代理）
- **图片引擎**：Seedream 4.5/5.0（火山引擎 ARK）、MJ（VectorEngine）、Gemini 3 Pro Image
- **视频引擎**：Seedance 1.5 Pro（跑量剧，火山引擎）/ Seedance 2.0（精品剧，火山引擎）

---

## 双线路工作流

### 共用阶段（Phase 1-2）

```
Phase 1: 导演分析 → director agent (director-skill)
  输出：讲戏本 + 人物清单 + 场景清单

Phase 2: 资产设计 → art-designer agent (art-design-skill)
  输出：角色提示词 + 场景提示词 → MJ/Seedream 生成参考图
```

### 精品剧路线（项目类型 = premium）

```
Phase 3A: Seedance 2.0 分镜提示词设计 → storyboard-artist agent (seedance-2-storyboard-skill)
  输入：讲戏本 + 人物清单 + 场景参考图（@Image1-9）
  输出：每镜头 Seedance 2.0 文生视频提示词（含 @tag 引用）

Phase 4A: 文生视频生成 → video-service.generateTextToVideo()
  输出：Seedance 2.0 视频

Phase 5A: 导出精品剧提示词脚本
```

### 跑量剧路线（项目类型 = batch）

```
Phase 3B: 首尾帧提示词生成 → frame-designer agent (frame-design-skill)
  输入：镜头描述 + 资产参考
  输出：每镜头首帧提示词 + 尾帧提示词

Phase 4B: 首帧图 + 尾帧图生成 → image-service.generateImage()
  引擎：Seedream 4.5（默认）

Phase 5B: 运动提示词生成 → prompt-engine.generateMotionPrompt()
  输入：首帧图 + 尾帧图 + 镜头描述 + 时长
  输出：英文运动提示词（60词以内）

Phase 6B: 图生视频 → video-service.generateImageToVideo()
  引擎：Seedance 1.5 Pro

Phase 7B: 导出跑量剧脚本（首帧+尾帧+运动提示词）
```

---

## Agent 体系

| Agent | 技能 | 路线 | 模型 |
|-------|------|------|------|
| director.md | director-skill | 共用 | sonnet |
| art-designer.md | art-design-skill | 共用 | sonnet |
| storyboard-artist.md | seedance-2-storyboard-skill | 精品剧 | opus |
| frame-designer.md | frame-design-skill | 跑量剧 | opus |

---

## 快速指令

- `~analyze` — 触发导演分析
- `~assets` — 触发资产设计
- `~s2prompt` — 触发 Seedance 2.0 分镜提示词（精品剧）
- `~frame` — 触发首尾帧提示词生成（跑量剧）
- `~motion` — 触发运动提示词生成（跑量剧）
- `~review` — 触发审核流程

---

## 审核工作流

每个输出阶段均有对应审核 skill：

- 美术资产审核：art-direction-review-skill（评分≥8分 PASS）
- 合规审核：compliance-review-skill
- 剧本结构审核：script-analysis-review-skill
- 精品剧分镜审核：seedance-prompt-review-skill
- 跑量剧首尾帧审核：frame-review-skill

---

## 编码规范

- TypeScript 零错误（每步 `pnpm check`）
- 65 个测试必须通过（每步 `pnpm test`）
- tRPC 路由接口不变，只改内部实现
- 所有新函数有 JSDoc 注释
- 外部 API 调用必须有重试机制（video-service / image-service 已内置）
- Seedream/Seedance 直调火山引擎 ARK API，禁止通过 VectorEngine 代理调用豆包模型
- MJ/Gemini/其他视频模型 通过 VectorEngine 代理
