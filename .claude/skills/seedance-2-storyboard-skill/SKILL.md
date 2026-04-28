# Seedance 2.0 Storyboard Skill — 精品剧分镜提示词生成

## 用途

精品剧核心技能：为每个镜头生成 Seedance 2.0 多参考文生视频提示词。
直接调用 `prompt-engine.ts` 的 `generateSeedance2Prompt()`。

---

## Seedance 2.0 核心规范

- **多模态输入**：最多 9图（@Image1-9）+ 3视频（@Video1-3）+ 3音频（@Audio1-3）
- **@tag 引用**：在提示词末尾明确标注每个 @Image 对应的角色或场景
- **提示词长度**：30-200 词（英文）
- **不支持负向提示词**，用正向约束替代（"sharp focus" 代替 "no blur"）
- **单镜头**：1-2 个角色，一个核心动作动词
- **时间轴分段**：镜头 > 5 秒时用 [0-5s] [5-10s] [10-15s] 分段描述

---

## 提示词结构

```
[Subject（主体描述+外观关键特征）],
[Action（核心动作 + 运动方式/速度）],
[Secondary motion（头发/衣摆/光影变化）],
[Camera（pan/dolly/orbit/tracking/zoom/static + 方向 + 速度）],
[Scene + Lighting（场景环境 + 光影）],
[Style（视觉风格 + 色调）].
Maintain face and clothing consistency, no distortion, high detail.
Character face stable without deformation, normal human structure, natural and smooth movements.
Generate video without subtitles.
Use @Image1 as [角色名] character reference, @Image2 as [场景名] scene reference.
```

---

## 运动节奏与时长对应

| 时长 | 节奏词 |
|------|--------|
| 2-3s | swift, quick, sudden |
| 4-6s | steady, gradual, smooth |
| 7-10s | slow, gentle, lingering |
| 10-15s | deliberate, contemplative, unhurried |

---

## @引用映射规则

资产库顺序决定 @tag 编号：
1. 所有角色参考图按出场顺序：@Image1, @Image2...
2. 场景参考图接续：@Image(N+1), @Image(N+2)...
3. 每条提示词末尾必须有完整的 @引用说明

---

## 与 frame-design-skill 的区别

| | Seedance 2.0 | Seedance 1.5 首尾帧 |
|--|---|---|
| 路线 | 精品剧 | 跑量剧 |
| 输入 | 文字 + @Image参考图 | 首帧图 + 尾帧图 + 运动提示词 |
| 首尾帧 | ❌ 不需要 | ✅ 必须 |
| 参考图 | 最多9张（角色+场景） | 无（已内嵌在首尾帧中） |
