# Motion Prompt Skill — Seedance 1.5 运动提示词

## 用途

跑量剧核心技能：基于已生成的首帧图和尾帧图，生成 Seedance 1.5 Pro 运动提示词，
描述从首帧到尾帧之间的运动过程（不描述起止状态）。

---

## 输入

- **首帧图片**：已生成的起始帧（S3 URL）
- **尾帧图片**：已生成的结束帧（S3 URL）
- **镜头描述**：原始 visualDescription
- **镜头时长**：目标秒数（4-12秒）

---

## 结构模板

```
The [subject] [primary_action] [manner/speed], [secondary_motion], [camera_movement], [environmental_motion], [transition_quality].
```

---

## 动作拆解原则

### 1. 主体动作（primary_action）

- 只描述首帧到尾帧之间的**运动过程**，不描述起止状态
- 动词必须是"运动中"的描述（rises, turns, reaches, falls 等）

### 2. 运动节奏（manner/speed）

| 时长 | 节奏词 |
|------|--------|
| 2-3s | swift / quick / sudden / abruptly |
| 4-6s | steady / gradual / smooth / fluidly |
| 7-10s | slow / gentle / lingering / deliberately |

### 3. 次要运动（secondary_motion）

- 头发飘动（hair rippling）
- 衣摆摇曳（clothing billowing/swaying）
- 光影变化（shadows shifting）
- 可选，根据实际首尾帧内容决定

### 4. 镜头运动（camera_movement）

- `static camera` — 固定机位
- `slow pan left/right` — 横摇
- `gentle tilt up/down` — 竖摇
- `slow dolly in/out` — 推/拉
- `subtle zoom in` — 缩放

### 5. 环境微动（environmental_motion）

- 风吹树叶（leaves rustling）
- 水面波纹（water rippling）
- 光斑移动（light dappling）
- 可选，根据实际场景决定

---

## 禁止项

- **不要**描述首帧或尾帧的静态画面
- **不要**出现 "starts from" / "ends at" / "beginning" / "ending"
- **不要**加入首尾帧中不存在的新元素（新人物、新道具等）
- **避免**物理上不可能的运动（如人物突然飞起来）

---

## 输出格式

```
Motion Prompt: [英文，2-3句，60词以内]

运动要素检查：
✓ 主体动作 — [简述]
✓ 次要运动 — [简述或 N/A]
✓ 镜头运动 — [简述]
✓ 环境微动 — [简述或 N/A]
✓ 首尾帧一致性 — [确认无矛盾]
```

---

## 示例

**镜头**：男主猛地站起来推倒酒杯（5秒）

**输出**：
> Motion Prompt: The man surges upward from his seat with sudden force, his arm sweeping outward as the wine glass topples and spills across the counter, static camera holds tight, ambient bar light flickering briefly as he rises.
>
> 运动要素检查：
> ✓ 主体动作 — 猛然起身 + 手臂横扫推杯
> ✓ 次要运动 — 酒液倾洒
> ✓ 镜头运动 — static camera
> ✓ 环境微动 — N/A（室内场景）
> ✓ 首尾帧一致性 — 服装/光线/场景道具一致

---

## 快速指令

- `~motion` — 触发当前镜头的运动提示词生成
