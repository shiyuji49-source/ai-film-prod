# Director Skill — 导演分析技能

## 用途

对剧本进行完整的导演分析，参考 `server/routers/ai.ts` 中的 `analyzeScript` 逻辑，
扩展为完整的讲戏本 + 人物清单 + 场景清单。

---

## 输入

- `scriptText`: 原始剧本文本（支持中文/英文，最大 50000 字）
- `projectConfig`:
  - `style`: "realistic" | "animation" | "cg"
  - `aspectRatio`: "portrait" | "landscape"
  - `genre`: 题材（e.g. "romance", "thriller", "action"）
  - `market`: 目标市场（e.g. "cn", "us"）

---

## 处理逻辑

### Step 1：剧本结构分析

识别：
- 幕次/集数划分
- 主要情节线（A线/B线）
- 情感高潮时间点
- 转折节点（Plot Points）

### Step 2：人物提取

对每个出现超过 1 次的人物：
- 姓名
- 角色定位（主角/配角/功能性人物）
- 外貌特征（年龄感、体型、发型/发色、典型服装）
- 性格特征（一句话概括）
- 在全剧的情感弧线

### Step 3：场景提取

对每个独立场景：
- 场景名称（内景/外景 + 地点）
- 环境描述（空间、家具、道具）
- 光线方向和色温（e.g. "下午侧光，暖黄色调"）
- 氛围基调（e.g. "紧张、压迫感"）
- 出现频次

### Step 4：导演讲戏本

- 整体节奏定位（快节奏跑量剧 / 沉浸式精品剧）
- 核心情感主题
- 关键场景的拍摄建议
- 角色关系动态（何时关系转变）

---

## 输出格式

```json
{
  "directorNotes": "导演讲戏本（500字以内）",
  "characters": [
    {
      "name": "角色名",
      "role": "主角",
      "description": "25岁，短发，偏瘦，常着职业装，眼神锐利",
      "arc": "从自我封闭到重新开放"
    }
  ],
  "scenes": [
    {
      "name": "公司会议室（内景）",
      "description": "现代商务风，落地窗，长桌，冷色调灯光",
      "atmosphere": "紧张、压迫感",
      "lightNote": "顶光为主，蓝白色调，无自然光"
    }
  ]
}
```

---

## 与 analyzeScript (ai.ts) 的关系

`analyzeScript` 关注精品剧的分镜拆解（每集20-30个镜头）。
本 skill 关注更宏观的导演视角，为 art-designer 提供人物/场景档案，
同时为分镜师提供情感节拍和叙事结构参考。
