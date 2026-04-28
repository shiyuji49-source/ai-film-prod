# Frame Design Skill — 跑量剧首尾帧提示词生成

## 用途

跑量剧核心技能：为每个镜头生成首帧（动作起始态）和尾帧（动作完成态）提示词，
供 Seedream 图片生成，再送入 Seedance 1.5 图生视频管线。

---

## 输入

- **主体参考**：角色外貌、服装（来自 `assets/character-prompts.md` 或资产库）
- **场景参考**：场景环境（来自 `assets/scene-prompts.md` 或资产库）
- **镜头编号**：整数，如 1, 2, 3...
- **镜头描述**：visualDescription（英文或中文均可）
- **景别与机位**：shotType（close_up/medium/wide/extreme_close/aerial/over_shoulder）
- **镜头时长**：duration（秒）

---

## 首帧规则（动作起始态）

1. 冻结在动作发生前的最后一刻
2. 人物姿态 = 动作的"蓄力状态"或"静止前态"（而非动作进行中）
3. 表情 = 情绪即将爆发前的微妙状态
4. 环境元素处于变化前的初始位置
5. 构图严格遵循景别与机位设定

---

## 尾帧规则（动作完成态）

1. 冻结在动作完成后的第一个静止瞬间
2. 人物姿态 = 动作的"收势"或"落定状态"（而非动作进行中）
3. 表情 = 情绪释放后的状态
4. 环境元素处于变化后的终止位置
5. 构图保持与首帧相同的景别机位（除非镜头本身有运动）

---

## 一致性约束（首尾帧必须相同）

| 维度 | 约束 |
|------|------|
| 光源方向 | 完全一致，不允许光源移位 |
| 色温/影调 | 完全一致（暖/冷/中性） |
| 人物服装 | 逐项复述，不可省略任何细节 |
| 人物发型 | 完全一致 |
| 配饰/道具 | 逐项复述 |
| 场景道具位置 | 仅允许镜头事件涉及的物体发生位移 |
| 画面风格关键词 | 首尾帧使用完全相同的风格后缀 |

---

## 输出格式

### 首帧

```
[风格前缀], [景别机位], [场景环境], [主体人物外貌服装], [人物起始姿态], [人物起始表情], [环境初始状态], [光影描述], [氛围关键词], [风格后缀]
```

### 尾帧

```
[风格前缀], [景别机位], [场景环境], [主体人物外貌服装], [人物终止姿态], [人物终止表情], [环境终止状态], [光影描述], [氛围关键词], [风格后缀]
```

### 示例

**镜头描述**：男主在酒吧猛地站起来，推倒了酒杯

**首帧**：
> Photorealistic cinematic still, medium shot, dimly lit modern bar interior with wooden counter and amber lights, 28-year-old Asian man in dark blue dress shirt and black trousers, seated on bar stool with both hands gripping the counter edge, jaw slightly clenched, eyes wide with restrained anger, full wine glass standing upright on counter, warm amber top lighting, tense confrontational atmosphere, film grain, 8K

**尾帧**：
> Photorealistic cinematic still, medium shot, dimly lit modern bar interior with wooden counter and amber lights, 28-year-old Asian man in dark blue dress shirt and black trousers, standing upright beside overturned bar stool, right arm extended from pushing motion, eyes fierce with released emotion, wine glass lying on its side with liquid spilling, warm amber top lighting (same direction), aftermath tension atmosphere, film grain, 8K

---

## 禁忌项

- 不在提示词中描述"运动过程"（那是 motion prompt 的职责）
- 不写"正在做"的动态描述，只写静止瞬间
- 不改变光源（除非镜头描述明确有光源变化）
- 不省略服装/发型的任何细节
