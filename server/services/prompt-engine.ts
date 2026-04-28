/**
 * Prompt Engine — 双线路提示词生成引擎
 *
 * 每个函数内部：组装 system prompt + user prompt → callLLM → 解析返回。
 *
 * System Prompt 模板硬编码在此文件（3.1-3.6节）。
 *
 * 共用阶段：
 *   - generateDirectorAnalysis   — 讲戏本 + 人物清单 + 场景清单
 *   - generateCharacterPrompt    — 角色设定提示词（供 image-service 生图）
 *   - generateScenePrompt        — 场景环境提示词（供 image-service 生图）
 *
 * 精品剧路线（Seedance 2.0 文生视频）：
 *   - generateSeedance2Prompt    — 多参考文生视频提示词（含 @tag 引用）
 *
 * 跑量剧路线（Seedance 1.5 Pro 首尾帧图生视频）：
 *   - generateFramePrompts       — 首帧+尾帧提示词对
 *   - generateMotionPrompt       — 运动提示词（英文 60 词以内）
 */
import { callLLM } from "./llm-service";

// ─── 共用类型 ──────────────────────────────────────────────────────────────────

export interface ShotInfo {
  shotNumber: number;
  sceneName: string;
  shotType: string;
  visualDescription: string;
  dialogue?: string;
  characters?: string;
  emotion?: string;
  /** 目标时长（秒） */
  duration?: number;
}

export interface CharacterInfo {
  name: string;
  description?: string;
  role?: string;
}

export interface SceneInfo {
  name: string;
  description?: string;
  atmosphere?: string;
}

export interface DirectorAnalysis {
  directorNotes: string;
  characters: Array<{ name: string; description: string; role: string; arc?: string }>;
  scenes: Array<{ name: string; description: string; atmosphere: string; lightNote?: string }>;
}

// ─── System Prompt 模板 ────────────────────────────────────────────────────────

/** 3.1 导演分析 System Prompt */
const DIRECTOR_ANALYSIS_SYSTEM_PROMPT = `你是一名资深影视导演。你的任务是分析剧本，为每个剧情点"讲戏"——像给演员和摄影师讲戏一样，把脑海中的影像完整描述出来。

## 输出格式

### 讲戏本
为每个剧情点输出：
- 剧情点编号和标题
- 导演阐述：用完整段落描述这个镜头应该是什么样的画面。包括：
  - 景别和机位（特写/中景/全景，俯拍/平拍等）
  - 人物的具体动作链（从A状态到B状态的完整物理动作过渡）
  - 光线描述（具体到方向、色温、强度，如"灰蓝色的清晨微光从左侧单窗斜射入室内"）
  - 情绪和氛围（通过视觉细节传达，不要抽象描述）
- 建议时长（4-15秒，每个beat约2.5秒，头尾各留0.5秒安全区）
- 涉及的人物
- 涉及的场景

### 人物清单
列出需要生成参考图的角色（出场2+个剧情点或预计后续复现的人物）：
| 角色名 | 外观关键词 | 出场剧情点 | 素材状态（新增/复用/变体）|

### 场景清单
| 场景名 | 时间 | 光线 | 色调 | 关键道具 | 出场剧情点 | 素材状态 |

## 规则
- 讲戏描述必须具体到摄影师不需要再问"你到底要什么效果"
- 光影必须具体到方向和色温，"光线柔和"不够具体
- 动作链必须连续，不能跳跃（上一秒做X下一秒突然做Y）
- 群演不入人物清单，但讲戏中需要具体描述其外观
`;

/** 3.2 资产设计 System Prompt（角色） */
const CHARACTER_PROMPT_SYSTEM = `你是一名专业的影视美术设定师。你的任务是为角色编写文生图提示词。

## 出图布局要求
一张图，左半边面部特写，右半边全身正面/侧面/背面三视图设定图，白色干净背景，角色设定图风格。

## 提示词要求
用完整的叙事性段落描述，不要逗号分隔的关键词堆叠。必须包含：
- 角色整体定位（年龄、性别、民族特征）
- 面部细节：脸型、五官、肤色、发型/发色、表情
- 体型：身高、体态
- 服装：款式、颜色、材质、细节（不要"穿红色衣服"，要"穿深红色修身棉袄外套，内搭碎花棉布衫"）
- 配饰：手表、耳环、眼镜、包等
- 鞋子

## 写法示范
中景，略微仰拍。冷蓝色的光线打在他脸上，勾勒出深刻的阴影。
（不要：中景, 低角度, 冷蓝色调, 戏剧性光影）

## 规则
- 所有描述必须具体到可视化的程度
- 摄影术语融入自然语言，不要孤立列出
- 情绪通过视觉细节传达，不要抽象描述
`;

/** 3.3 资产设计 System Prompt（场景） */
const SCENE_PROMPT_SYSTEM = `你是一名专业的影视美术设定师。你的任务是为场景编写文生图提示词。

## 出图布局要求
一张宫格图，每格一个场景：
- ≤9个场景 → 3×3九宫格
- 10-12个场景 → 3×4宫格
- 13-16个场景 → 4×4宫格

## 每个格子的提示词必须包含
- 地点类型与空间布局
- 时间（影响光照）
- 光源类型与光线方向
- 整体色调/色彩倾向
- 关键道具/家具/物件
- 空间纵深与层次
- 氛围/情绪
- 风格（写实/电影感等）

## 规则
- 所有格子必须保持视觉风格统一，光影逻辑自洽
- 叙事描述式，不要关键词堆叠
- 每个场景描述必须具体到服化道设计师能据此生成参考图
`;

/** 3.4 首尾帧提示词 System Prompt（跑量剧专用） */
const FRAME_PROMPT_SYSTEM = `你是一名首尾帧提示词设计师。你的任务是为跑量剧的图生视频模式设计两张静态画面的提示词：首帧（动作起始态）和尾帧（动作完成态）。Seedance 1.5 Pro 会在两帧之间自动补间生成视频。

## 输入
你会收到：
- 镜头描述（这个镜头里发生了什么事件/动作）
- 景别与机位（特写/中景/全景，俯拍/平拍等）
- 镜头时长（秒数，影响动作幅度）
- 角色外貌和服装的完整描述
- 场景环境的完整描述

## 首帧规则（动作起始态）
1. 冻结在动作发生前的最后一刻
2. 人物姿态 = 动作的"蓄力状态"或"静止前态"
3. 表情 = 情绪即将爆发前的微妙状态
4. 环境元素处于变化前的初始位置
5. 构图严格遵循景别与机位设定

## 尾帧规则（动作完成态）
1. 冻结在动作完成后的第一个静止瞬间
2. 人物姿态 = 动作的"收势"或"落定状态"
3. 表情 = 情绪释放后的状态
4. 环境元素处于变化后的终止位置
5. 构图保持与首帧相同的景别机位（除非镜头本身有运动）

## 一致性约束（首尾帧之间必须一致的项）
- 光源方向、色温、影调：完全一致
- 人物服装、发型、配饰：逐项复述，不可省略
- 场景道具位置：仅允许镜头事件涉及的物体发生位移
- 画面风格关键词：首尾帧使用完全相同的风格后缀

## 输出格式

### 首帧提示词
[风格前缀], [景别机位], [场景环境], [主体人物外貌服装（逐项复述）],
[人物起始姿态], [人物起始表情], [环境初始状态],
[光影描述], [氛围关键词], [风格后缀]

### 尾帧提示词
[风格前缀], [景别机位], [场景环境], [主体人物外貌服装（逐项复述）],
[人物终止姿态], [人物终止表情], [环境终止状态],
[光影描述], [氛围关键词], [风格后缀]

两段提示词直接输出，不要解释设计理由。
`;

/** 3.5 Seedance 2.0 提示词 System Prompt（精品剧专用） */
const SEEDANCE2_PROMPT_SYSTEM = `你是一名 Seedance 2.0 视频提示词专家。Seedance 2.0 是文生视频+多参考模式，用户提供角色参考图和场景参考图，模型基于提示词和参考图生成视频。

## 重要：Seedance 2.0 不使用首尾帧！
Seedance 2.0 的工作方式是：文本提示词 + @引用参考图（角色/场景/风格） → 直接生成视频。
不要提到首帧、尾帧、first frame、last frame。

## 输入
你会收到：
- 镜头描述（这个镜头里发生的事件）
- 镜头时长（目标秒数）
- 参考图列表（将作为 @Image1=角色A参考, @Image2=角色B参考, @Image3=场景参考 等）

## 提示词结构（英文）
[Subject（主体描述+外观关键特征）],
[Action（核心动作 + 运动方式/速度）],
[Secondary motion（次要运动：头发/衣摆/光影变化等）],
[Camera（镜头运动：pan/dolly/orbit/tracking/zoom/static + 方向 + 速度）],
[Scene + Lighting（场景环境 + 光影描述）],
[Style（视觉风格 + 色调）].
Maintain face and clothing consistency, no distortion, high detail.
Character face stable without deformation, normal human structure, natural and smooth movements.
Generate video without subtitles.
Use @Image1 as character reference, @Image2 as scene reference.

## 规则
1. 每个镜头一个核心动作动词
2. 运动节奏匹配时长：
   - 2-3秒 → swift, quick, sudden
   - 4-6秒 → steady, gradual, smooth
   - 7-10秒 → slow, gentle, lingering
   - 10-15秒 → deliberate, contemplative, unhurried
3. 必须包含次要运动（头发飘动、衣摆摇曳等）
4. 必须指定镜头运动（或 static camera）
5. 物理细节提升真实感（摩擦、重力、碰撞等）
6. 角色外观关键特征要简要重复（与参考图呼应）

## 禁止项
- 不要使用负向提示词（如 "no blur"，改用 "sharp focus"）
- 不要在单镜头中放多个核心动作动词
- 避免物理上不可能的运动轨迹
- 单镜头最多 1-2 个角色

## 长度
控制在 30-200 词（英文）。

## @引用规则
根据提供的参考图列表，在提示词末尾标注每张图的角色：
Use @Image1 as [角色A名] character reference, @Image2 as [场景名] scene reference.

直接输出英文提示词，不要解释。
`;

/** 精品剧分镜草图 System Prompt */
const STORYBOARD_SKETCH_SYSTEM = `你是一名专业影视分镜师。你的任务是把镜头设计转写成适合 image2 生成的分镜草图提示词。

输出必须是一段可直接用于生图的中文提示词，要求：
- 黑白简笔线稿，粗略手绘 storyboard sketch，保留构图、人物站位、景别、视线方向
- 画面不能像成片剧照，不能追求精致渲染
- 必须包含：景别、机位角度、人物数量与站位、主体动作、场景空间关系、关键道具
- 允许使用箭头表达视线/移动方向，但不要生成文字、字幕、Logo、水印
- 单张图，只画当前镜头，不要拼图，不要多格漫画

只输出提示词本身，不要解释。`;

/** 精品剧人物调度与机位示意图 System Prompt */
const CAMERA_DIAGRAM_SYSTEM = `你是一名导演组现场调度图设计师。你的任务是把一个 15 秒左右的视频镜头，转写成适合 image2 生成的“人物调度与摄影机机位运动示意图”提示词。

输出必须是一段可直接用于生图的中文提示词，要求：
- 黑白线稿示意图，不是剧照，不是海报
- 以俯视平面图为主，可加入小幅侧视补充，但必须清晰表达空间关系
- 必须包含：人物起点/终点、运动路线箭头、摄影机位置、镜头朝向、机位运动轨迹、景别变化
- 用简单几何符号、箭头、虚线轨迹表达，不要复杂写实细节
- 不要生成可读文字、字幕、Logo、水印

只输出提示词本身，不要解释。`;

/** 3.6 运动提示词 System Prompt（跑量剧专用 — Seedance 1.5 首尾帧图生视频） */
const MOTION_PROMPT_SYSTEM = `你是一名视频运动提示词专家。你的任务是为首尾帧图生视频模式编写运动描述。

## 工作模式
用户已经有了首帧图片和尾帧图片，Seedance 1.5 Pro 会在两帧之间自动补间生成视频。你只需要描述从首帧到尾帧之间的运动过程。

## 输入
你会收到：
- 首帧描述（已生成的起始画面）
- 尾帧描述（已生成的结束画面）
- 镜头描述（这个镜头里发生的事件）
- 镜头时长（目标秒数）

## 运动提示词结构（英文）
The [subject] [primary_action] [manner/speed],
[secondary_motion], [camera_movement],
[environmental_motion], [transition_quality].

## 规则
1. 只描述首帧到尾帧之间的运动过程，不描述起止状态
2. 运动节奏匹配时长：
   - 2-3秒 → swift, quick, sudden
   - 4-6秒 → steady, gradual, smooth
   - 7-10秒 → slow, gentle, lingering
3. 必须包含次要运动（头发、衣摆、光影变化）
4. 必须指定镜头运动或 static
5. 建议包含环境微动（风、水面、光斑等）

## 禁止项
- 不要描述首帧或尾帧的静态画面内容
- 不要出现 "starts from" / "ends at" 这类起止描述
- 不要加入首尾帧中不存在的新元素
- 避免物理上不可能的运动轨迹

## 长度
控制在 60 词以内（英文）。

直接输出英文运动描述，2-3 句话。不要解释。
`;

// ─── 共用阶段函数 ──────────────────────────────────────────────────────────────

/**
 * 导演分析（共用阶段）
 *
 * 输入剧本 → 输出讲戏本 + 人物清单 + 场景清单。
 *
 * @param script 原始剧本文本
 * @param config 项目配置
 * @returns DirectorAnalysis
 */
export async function generateDirectorAnalysis(
  script: string,
  config: { style: string; mediaType?: string; market?: string }
): Promise<DirectorAnalysis> {
  const response = await callLLM({
    systemPrompt: DIRECTOR_ANALYSIS_SYSTEM_PROMPT,
    prompt: `剧本内容（风格：${config.style}，题材：${config.mediaType ?? "短剧"}，市场：${config.market ?? "cn"}）：

${script.slice(0, 50000)}

请输出 JSON：
{
  "directorNotes": "讲戏本（整体叙事节奏+每个重要剧情点的导演阐述）",
  "characters": [{ "name": "角色名", "description": "外观+性格描述", "role": "主角/配角", "arc": "情感弧线" }],
  "scenes": [{ "name": "场景名", "description": "环境描述", "atmosphere": "氛围基调", "lightNote": "光线方向和色温" }]
}`,
    responseFormat: {
      type: "json_schema",
      json_schema: {
        name: "director_analysis",
        strict: true,
        schema: {
          type: "object",
          properties: {
            directorNotes: { type: "string" },
            characters: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  role: { type: "string" },
                  arc: { type: "string" },
                },
                required: ["name", "description", "role", "arc"],
                additionalProperties: false,
              },
            },
            scenes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  atmosphere: { type: "string" },
                  lightNote: { type: "string" },
                },
                required: ["name", "description", "atmosphere", "lightNote"],
                additionalProperties: false,
              },
            },
          },
          required: ["directorNotes", "characters", "scenes"],
          additionalProperties: false,
        },
      },
    },
    temperature: 0.7,
  });

  return JSON.parse(response) as DirectorAnalysis;
}

/**
 * 角色设定提示词生成（共用阶段）
 *
 * 输出可直接用于 MJ/Seedream 的完整角色参考图提示词。
 *
 * @param character 角色信息
 * @param style 项目风格（e.g. "realistic"）
 * @returns 英文角色提示词
 */
export async function generateCharacterPrompt(
  character: CharacterInfo,
  style: string
): Promise<string> {
  return callLLM({
    systemPrompt: CHARACTER_PROMPT_SYSTEM,
    prompt: `请为以下角色生成完整的 Midjourney v7 文生图提示词（英文）。

角色名：${character.name}
角色定位：${character.role ?? ""}
描述：${character.description ?? "(无具体描述)"}
整体风格：${style}

要求：
- 叙事描述式，不要关键词堆叠
- 全身正面站姿 + 面部特写，白色背景
- 风格末尾加 --ar 9:16 --style raw --q 2
- 只输出英文提示词，不要解释`,
    temperature: 0.8,
  });
}

/**
 * 场景环境提示词生成（共用阶段）
 *
 * 输出可直接用于 MJ/Seedream 的完整场景参考图提示词。
 *
 * @param scene 场景信息
 * @param style 项目风格
 * @returns 英文场景提示词
 */
export async function generateScenePrompt(scene: SceneInfo, style: string): Promise<string> {
  return callLLM({
    systemPrompt: SCENE_PROMPT_SYSTEM,
    prompt: `请为以下场景生成完整的 Midjourney v7 文生图提示词（英文）。

场景名：${scene.name}
描述：${scene.description ?? "(无具体描述)"}
氛围：${scene.atmosphere ?? ""}
整体风格：${style}

要求：
- 叙事描述式，不要关键词堆叠
- 16:9 横屏，建立镜头，无人物
- 风格末尾加 --ar 16:9 --style raw --q 2
- 只输出英文提示词，不要解释`,
    temperature: 0.8,
  });
}

// ─── 精品剧：Seedance 2.0 多参考文生视频提示词 ────────────────────────────────

export interface Seedance2ReferenceImage {
  role: "character" | "scene" | "style";
  url: string;
  name: string;
}

/**
 * 精品剧：Seedance 2.0 多参考文生视频提示词生成
 *
 * 输出含 @tag 引用的英文视频提示词（30-200词）。
 *
 * @param shot 镜头信息
 * @param referenceImages 参考图列表（来自资产库）
 * @returns 英文 Seedance 2.0 提示词
 */
export async function generateSeedance2Prompt(
  shot: ShotInfo,
  referenceImages: Seedance2ReferenceImage[]
): Promise<string> {
  const duration = shot.duration ?? 5;

  // 构建参考图映射说明
  const refList = referenceImages
    .slice(0, 9)
    .map((r, i) => `@Image${i + 1} = ${r.name}（${r.role}参考）`)
    .join("\n");

  return callLLM({
    systemPrompt: SEEDANCE2_PROMPT_SYSTEM,
    prompt: `请为以下镜头生成 Seedance 2.0 视频提示词（英文，${30}-${200}词）：

镜头编号：${shot.shotNumber}
场景：${shot.sceneName}
景别机位：${shot.shotType}
镜头描述：${shot.visualDescription}
${shot.dialogue ? `台词："${shot.dialogue}"` : ""}
${shot.characters ? `人物：${shot.characters}` : ""}
${shot.emotion ? `情绪：${shot.emotion}` : ""}
目标时长：${duration}秒

可用参考图：
${refList || "（无参考图）"}

直接输出英文提示词。`,
    temperature: 0.8,
  });
}

/**
 * 精品剧：分镜草图 image2 提示词生成
 *
 * @param shot 镜头信息
 * @param style 项目视觉风格
 * @returns 适合 image2 的黑白分镜草图提示词
 */
export async function generateStoryboardSketchPrompt(
  shot: ShotInfo,
  style: string
): Promise<string> {
  return callLLM({
    systemPrompt: STORYBOARD_SKETCH_SYSTEM,
    prompt: `请把以下镜头改写成 image2 分镜草图提示词：

项目风格：${style}
镜头编号：${shot.shotNumber}
场景：${shot.sceneName}
景别机位：${shot.shotType}
镜头描述：${shot.visualDescription}
${shot.dialogue ? `台词/旁白：${shot.dialogue}` : ""}
${shot.characters ? `人物：${shot.characters}` : ""}
${shot.emotion ? `情绪：${shot.emotion}` : ""}

输出一段中文提示词。`,
    temperature: 0.65,
  });
}

/**
 * 精品剧：人物调度与摄影机机位图 image2 提示词生成
 *
 * @param shot 镜头信息
 * @param seedancePrompt 视频提示词，用于提取动作和机位运动
 * @returns 适合 image2 的调度/机位示意图提示词
 */
export async function generateCameraDiagramPrompt(
  shot: ShotInfo,
  seedancePrompt?: string
): Promise<string> {
  return callLLM({
    systemPrompt: CAMERA_DIAGRAM_SYSTEM,
    prompt: `请把以下视频镜头改写成 image2 调度与机位示意图提示词：

镜头编号：${shot.shotNumber}
场景：${shot.sceneName}
景别机位：${shot.shotType}
镜头描述：${shot.visualDescription}
${shot.dialogue ? `台词/旁白：${shot.dialogue}` : ""}
${shot.characters ? `人物：${shot.characters}` : ""}
${shot.emotion ? `情绪：${shot.emotion}` : ""}
目标时长：${shot.duration ?? 15}秒
${seedancePrompt ? `Seedance 2.0 视频提示词：${seedancePrompt}` : ""}

输出一段中文提示词。`,
    temperature: 0.65,
  });
}

// ─── 跑量剧：首尾帧提示词对 ───────────────────────────────────────────────────

export interface FramePrompts {
  firstFrame: string;
  lastFrame: string;
}

/**
 * 跑量剧：首帧 + 尾帧提示词生成
 *
 * @param shot 镜头信息
 * @param characterPrompts 角色名 → 外貌描述（从资产库）
 * @param scenePrompts 场景名 → 场景描述（从资产库）
 * @returns { firstFrame, lastFrame }
 */
export async function generateFramePrompts(
  shot: ShotInfo,
  characterPrompts: Record<string, string>,
  scenePrompts: Record<string, string>
): Promise<FramePrompts> {
  // 拼接角色和场景上下文
  const charContext = Object.entries(characterPrompts)
    .map(([name, desc]) => `${name}：${desc}`)
    .join("\n");
  const sceneContext = Object.entries(scenePrompts)
    .map(([name, desc]) => `${name}：${desc}`)
    .join("\n");

  const response = await callLLM({
    systemPrompt: FRAME_PROMPT_SYSTEM,
    prompt: `请为以下镜头生成首帧和尾帧提示词：

镜头描述：${shot.visualDescription}
景别机位：${shot.shotType || "medium shot"}
${shot.dialogue ? `台词："${shot.dialogue}"` : ""}
${shot.characters ? `人物：${shot.characters}` : ""}
${shot.emotion ? `情绪：${shot.emotion}` : ""}
镜头时长：${shot.duration ?? 5}秒

角色外貌参考：
${charContext || "（未提供）"}

场景环境参考：
${sceneContext || "（未提供）"}

请输出 JSON：{"firstFrame": "首帧提示词（英文）", "lastFrame": "尾帧提示词（英文）"}`,
    responseFormat: {
      type: "json_schema",
      json_schema: {
        name: "frame_prompts",
        strict: true,
        schema: {
          type: "object",
          properties: {
            firstFrame: { type: "string" },
            lastFrame: { type: "string" },
          },
          required: ["firstFrame", "lastFrame"],
          additionalProperties: false,
        },
      },
    },
    temperature: 0.7,
  });

  return JSON.parse(response) as FramePrompts;
}

// ─── 跑量剧：运动提示词 ────────────────────────────────────────────────────────

/**
 * 跑量剧：Seedance 1.5 Pro 运动提示词生成
 *
 * 描述从首帧到尾帧之间的运动过程（不描述起止状态），60词以内。
 *
 * @param shot 镜头信息（含 duration）
 * @param frames 已生成的首尾帧描述
 * @returns 英文运动提示词（60词以内）
 */
export async function generateMotionPrompt(
  shot: ShotInfo,
  frames: FramePrompts
): Promise<string> {
  const duration = shot.duration ?? 5;

  return callLLM({
    systemPrompt: MOTION_PROMPT_SYSTEM,
    prompt: `首帧描述：${frames.firstFrame}

尾帧描述：${frames.lastFrame}

镜头描述：${shot.visualDescription}
${shot.characters ? `人物：${shot.characters}` : ""}
镜头时长：${duration}秒

请输出英文运动提示词（60词以内，2-3句话）。`,
    temperature: 0.7,
  });
}
