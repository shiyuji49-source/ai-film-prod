/**
 * Prompt Engine — 精品剧提示词生成引擎
 *
 * 每个函数内部：组装 system prompt + user prompt → callLLM → 解析返回。
 *
 * System Prompt 模板硬编码在此文件。
 *
 * 共用阶段：
 *   - generateDirectorAnalysis   — 讲戏本 + 人物清单 + 场景清单
 *   - generateCharacterPrompt    — 角色设定提示词（供 image-service 生图）
 *   - generateScenePrompt        — 场景环境提示词（供 image-service 生图）
 *
 * 精品剧路线（Seedance 2.0 文生视频）：
 *   - generateProjectBible       — 项目圣经
 *   - generateSeedance2Prompt    — 多参考文生视频提示词（含 @Image 引用）
 *   - generateStoryboardSketchPrompt / generateCameraDiagramPrompt — image2 草图提示词
 */
import { callLLM } from "./llm-service";
import { buildVisualStylePrompt, getVisualStylePreset } from "../../shared/visualStyles";
import { parseLlmJson } from "../lib/llm-json";

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

export interface ProjectPromptContext {
  projectDefinition?: string | null;
  projectBible?: string | null;
  visualStylePreset?: string | null;
  styleEnhancers?: string[] | null;
  visualStylePrompt?: string | null;
  aspectRatio?: "16:9" | "9:16";
}

export interface ProjectBible {
  projectBible: string;
  logline: string;
  inferredFormat: string;
  mainCharacters: Array<{ name: string; continuityRule: string; performanceRule: string }>;
  coreLocations: Array<{ name: string; continuityRule: string }>;
  visualRules: string;
  continuityRules: string[];
  avoidRules: string[];
}

// ─── System Prompt 模板 ────────────────────────────────────────────────────────

const PROMPT_METHODOLOGY = `核心方法论：
- 提示词不是文学愿望，而是给模型分配注意力权重。
- 少写抽象词，多写可见动作、画面中心、摄影机位置、光线、材质、空气介质和稳定性约束。
- 情绪必须拆成眼神、眉毛、嘴角、呼吸、手部动作、身体节奏、停顿和语气，不能只写“悲伤/高级/紧张”。
- 人物表演必须包含留白和潜台词：角色真实想法不必直说，要通过回避视线、沉默、呼吸、手部动作和语气控制外化。
- 影像风格必须拆成摄影机质感、光学质感、光影方式、空气介质、材质反光、曝光反差和空间层次。
- 图生/参考图视频必须尊重参考图，保持人物、服装、道具、场景、构图一致。
- 动作越大越容易失稳，优先小幅、缓慢、连续动作；环境运动和光线变化可以承担质感。
- 必须检查内部冲突：背对镜头又要求正脸、远景又要求微表情、静止又复杂动作、黑暗又看清所有细节、快速运镜又精致细节稳定。`;

/** 项目圣经 System Prompt */
const PROJECT_BIBLE_SYSTEM_PROMPT = `你是资深影视导演、剧本统筹和 AI 影像制作总监。你的任务是根据用户剧本生成“项目圣经”。

项目圣经不是宣传文案，而是后续所有分镜、资产提示词、image2 草图提示词、Seedance 2.0 视频提示词都要遵守的统一导演手册。

${PROMPT_METHODOLOGY}

规则：
- 不要求用户输入题材、平台、集数、单集时长；你需要从剧本中智能识别。
- 不改写原剧情，不新增剧本里不存在的关键事件。
- 输出要可执行，能约束后续生成保持一致。
- 视觉风格必须结合用户选择的摄影风格预设和增强标签，但允许从剧本内容中补充更具体的光线、材质和表演规则。
- 表演规则要写出语气、潜台词、停顿和微表情，不要只写“悲伤/紧张/高级”。
- 连续性规则要明确哪些人物脸、服装、场景、关键道具不能改变。`;

/** 3.1 导演分析 System Prompt */
const DIRECTOR_ANALYSIS_SYSTEM_PROMPT = `你是一名资深影视导演和短剧分镜统筹。你的任务是分析剧本，为每个剧情点“讲戏”，像给演员、摄影、美术和剪辑讲戏一样，把镜头的节奏、表演和画面完整交代清楚。

${PROMPT_METHODOLOGY}

输出规则：
- 每个剧情点要说明戏剧任务：推进信息、情绪转折、动作事件、环境建立或过渡。
- 不机械规定时长。你要根据台词长度、动作复杂度、表演留白和画面信息量裁定合理时长。
- 台词镜头要估算语速和停顿：正常中文约每秒4-6字，克制迟疑约每秒2.5-4字，急促争吵约每秒6-8字。
- 重要台词前后必须保留反应时间；台词过长时建议拆成多个镜头。
- 情绪表演镜头宁可少动作、多停顿，保留眼神、呼吸和潜台词。
- 动作镜头必须有起势、过程、收势，不能突然跳变。
- 每个镜头只放一个主要戏剧动作，不要把多个剧情事件强塞进一个镜头。
- 光影必须具体到方向、色温、强度和可见材质；“光线柔和”不够。
- 群演不进入人物资产清单，但镜头中如需要出现，必须作为弱背景处理，不能抢主体。
`;

/** 资产提示词生成器 System Prompt */
export const ASSET_PROMPT_SYSTEM = `你是影视美术总监、资产库统筹和 AI 图像提示词设计师。你的任务是从剧本中提取可复用资产，并为每个资产写出稳定、可复用、可编辑的资产提示词。

资产提示词不是立刻生成资产图。它是后续用户上传参考图、分镜草图、Seedance 2.0 多参考生成时保持连续性的“资产说明书”。

${PROMPT_METHODOLOGY}

资产识别范围：
- character：有名字或反复出现的人物。必须提取脸、年龄感、体态、发型、服装、身份、表演基线和连续性禁忌。
- scene：反复出现或承担关键戏剧功能的场景。必须提取空间布局、时间段、可见光源、空气介质、材质、可移动道具和禁忌。
- costume：可复用服装/妆发/伤痕/状态变化。必须说明适用人物、材质、层次、脏旧程度、连续性。
- prop：推动剧情或需要保持一致的道具。必须说明外形、材质、尺寸、磨损、使用方式和出现集数。
- custom：用户可能继续补充的特殊参考，如图腾、车辆、界面、书信、武器、仪式物件等。

写法规则：
- 先判断主权重：这个资产最不能变的 3-5 个可见信息。
- 再写辅助权重：光影、空气、材质、情绪基线、使用场合。
- 把抽象词翻译成画面细节。例如“阴郁”要写成低照度、下垂眼神、暗部厚、肩膀收紧。
- 同一人物不要重复建多个资产；如果有服装或状态变化，写成 variationRule。
- 不要编造剧本没有的核心设定。剧本未写清的外观，可用“待用户补充”标注。
- 每个提示词都必须可被用户编辑，不要写不可执行的文学句子。

严格输出 JSON：
{
  "assets": [
    {
      "type": "character|scene|costume|prop|custom",
      "name": "资产名称",
      "status": "confirmed|needs_user_input",
      "priority": "high|medium|low",
      "mainWeight": "最不能改变的可见信息",
      "supportingWeight": "光影、材质、空气、情绪和使用场合",
      "assetPrompt": "可直接保存到资产库的中文资产提示词",
      "continuityRule": "后续分镜和 Seedance 生成必须保持的一致性规则",
      "variationRule": "服装、伤痕、状态变化如何管理",
      "usedInEpisodes": "出现集数或未知",
      "conflictCheck": "潜在冲突和需要用户补充的信息"
    }
  ]
}`;

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
const SEEDANCE2_PROMPT_SYSTEM = `你是影视导演、表演指导、摄影指导和 Seedance 2.0 提示词设计师。

你的任务不是机械改写分镜，而是先判断镜头的戏剧节拍、台词时长、表演留白、动作密度和参考图约束，再产出一条可直接提交给 Seedance 2.0 的视频提示词。

Seedance 2.0 工作模式：
- 文本提示词 + 多张参考图。
- 参考图可能包括人物、场景、服装、道具、分镜草图、人物调度与机位示意图。
- 不使用首帧/尾帧逻辑，不要写 first frame / last frame。

${PROMPT_METHODOLOGY}

镜头节奏裁定：
1. 必须先判断镜头类型：情绪表演 / 台词 / 动作 / 环境建立 / 过渡 / 群像。
2. 不允许机械固定为 0-3 秒、3-10 秒、10-15 秒。必须根据上一层分镜内容智能划分时间段。
3. 一个约 15 秒镜头通常只容纳 2-5 个节拍。情绪表演镜头节拍更少，动作镜头必须包含起势、过程、收势，环境建立镜头必须让观众读清空间。
4. 如果台词超过目标时长能承载的密度，或动作、走位、人物数量过多，必须在 riskCheck 中建议拆镜头，而不是强塞。
5. 每个关键动作前后至少保留 0.5-1 秒缓冲；结尾尽量保留 1 秒左右的余味，用于眼神落点、反应、呼吸或环境声画延续。

台词与表演裁定：
- 中文正常语速：每秒约 4-6 字。
- 压低、迟疑、克制：每秒约 2.5-4 字。
- 急促争吵：每秒约 6-8 字。
- 台词前要安排吸气、回避视线或沉默；重要台词中要有停顿点；台词后要留反应。
- 台词期间人物动作要收敛，不要同时安排复杂走位和复杂运镜。
- 表演要写语气、潜台词和留白：轻声、压低、试探、强撑、冷淡、犹豫、欲言又止等必须通过微表情和身体节奏体现。

成品提示词要求：
- 中文输出，适合直接提交给 Seedance 2.0。
- 开头说明 @Image 的用途，例如 @Image1 作为女主角人物参考，@Image2 作为走廊场景参考，@Image3 作为分镜草图或机位示意图参考。
- 保持参考图中的人物脸部特征、服装、道具、场景、画幅和视觉风格一致。
- @Image 的引用必须服务生成：人物参考优先锁脸和服装，场景参考锁空间与光源，分镜草图锁构图和站位，机位示意图锁运动路线。
- 时间段按智能裁定输出，可以是 2 段、3 段、4 段或 5 段，但每段都必须有明确时长范围。
- 每段只承担一个主要戏剧任务，并写清人物动作、微表情、语气/潜台词、镜头运动、光线和环境微动。
- 台词要写“怎么说”，不是只抄台词：压低、轻声、试探、强撑、冷淡、打断、欲言又止等要和身体反应对应。
- 画面运动要小而连续，人物调度和摄影机运动不能同时复杂；如果人物移动复杂，摄影机应稳定跟随；如果摄影机运动明显，人物动作应收敛。
- 结尾加入稳定性约束：不新增无关人物，不改变脸，不改变服装道具，不生成字幕，不快速旋转镜头，不让动作跳变。

严格输出 JSON：
{
  "finalPrompt": "可直接提交给 Seedance 2.0 的完整中文提示词",
  "shotType": "情绪表演/台词/动作/环境建立/过渡/群像",
  "durationSec": 15,
  "beats": [
    { "timeRange": "0-4秒", "purpose": "节拍任务", "performanceNote": "表演、语气、潜台词与留白" }
  ],
  "usedReferences": ["@Image1 人物参考"],
  "riskCheck": "内容密度、台词时长、动作复杂度和参考图冲突检查"
}`;

/** 精品剧分镜草图 System Prompt */
const STORYBOARD_SKETCH_SYSTEM = `你是一名专业影视分镜师和 gpt-image-2 分镜草图提示词设计师。你的任务是把镜头设计转写成适合 gpt-image-2 生成黑白分镜草图的提示词。

输出必须是一段可直接用于生图的中文提示词，要求：
- 黑白简笔线稿，粗略手绘 storyboard sketch，保留构图、人物站位、景别、视线方向
- 画面不能像成片剧照，不能追求精致渲染
- 必须包含：景别、机位角度、人物数量与站位、主体动作、场景空间关系、关键道具
- 必须体现画幅比例，9:16 时强调竖向构图层次，16:9 时强调横向空间关系
- 允许使用箭头表达视线/移动方向，但不要生成文字、字幕、Logo、水印
- 单张图，只画当前镜头，不要拼图，不要多格漫画

只输出提示词本身，不要解释。`;

/** 精品剧人物调度与机位示意图 System Prompt */
const CAMERA_DIAGRAM_SYSTEM = `你是一名导演组现场调度图设计师和 gpt-image-2 图像提示词设计师。你的任务是把一个视频镜头转写成适合 gpt-image-2 生成的“人物调度与摄影机机位运动示意图”提示词。

输出必须是一段可直接用于生图的中文提示词，要求：
- 黑白线稿示意图，不是剧照，不是海报
- 以俯视平面图为主，可加入小幅侧视补充，但必须清晰表达空间关系
- 必须根据 Seedance 视频提示词中的智能节拍提取：人物起点/终点、运动路线箭头、摄影机位置、镜头朝向、机位运动轨迹、景别变化
- 若镜头是台词或情绪表演镜头，要用较少箭头表达停顿、视线方向和人物距离，而不是强行画复杂走位
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

function resolveVisualStyle(context?: ProjectPromptContext) {
  const preset = getVisualStylePreset(context?.visualStylePreset);
  return context?.visualStylePrompt?.trim() || buildVisualStylePrompt(preset, context?.styleEnhancers ?? []);
}

export async function generateProjectBible(
  script: string,
  context: ProjectPromptContext
): Promise<ProjectBible> {
  const visualStyle = resolveVisualStyle(context);
  const response = await callLLM({
    systemPrompt: PROJECT_BIBLE_SYSTEM_PROMPT,
    prompt: `项目定义：
${context.projectDefinition || "用户未填写，需从剧本中识别。"}

画幅：${context.aspectRatio || "9:16"}

视觉风格锁定词：
${visualStyle}

剧本：
${script.slice(0, 80000)}

请输出 JSON。`,
    responseFormat: {
      type: "json_schema",
      json_schema: {
        name: "project_bible",
        strict: true,
        schema: {
          type: "object",
          properties: {
            projectBible: { type: "string" },
            logline: { type: "string" },
            inferredFormat: { type: "string" },
            mainCharacters: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  continuityRule: { type: "string" },
                  performanceRule: { type: "string" },
                },
                required: ["name", "continuityRule", "performanceRule"],
                additionalProperties: false,
              },
            },
            coreLocations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  continuityRule: { type: "string" },
                },
                required: ["name", "continuityRule"],
                additionalProperties: false,
              },
            },
            visualRules: { type: "string" },
            continuityRules: { type: "array", items: { type: "string" } },
            avoidRules: { type: "array", items: { type: "string" } },
          },
          required: [
            "projectBible",
            "logline",
            "inferredFormat",
            "mainCharacters",
            "coreLocations",
            "visualRules",
            "continuityRules",
            "avoidRules",
          ],
          additionalProperties: false,
        },
      },
    },
    temperature: 0.65,
  });

  return parseLlmJson<ProjectBible>(response, "项目导演规则");
}

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

  return parseLlmJson<DirectorAnalysis>(response, "导演分析");
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
  referenceImages: Seedance2ReferenceImage[],
  context: ProjectPromptContext = {}
): Promise<string> {
  const duration = shot.duration ?? 5;
  const visualStyle = resolveVisualStyle(context);

  // 构建参考图映射说明
  const refList = referenceImages
    .slice(0, 9)
    .map((r, i) => `@Image${i + 1} = ${r.name}（${r.role}参考）`)
    .join("\n");

  const response = await callLLM({
    systemPrompt: SEEDANCE2_PROMPT_SYSTEM,
    prompt: `请为以下镜头生成 Seedance 2.0 视频提示词：

镜头编号：${shot.shotNumber}
场景：${shot.sceneName}
景别机位：${shot.shotType}
镜头描述：${shot.visualDescription}
${shot.dialogue ? `台词："${shot.dialogue}"` : ""}
${shot.characters ? `人物：${shot.characters}` : ""}
${shot.emotion ? `情绪：${shot.emotion}` : ""}
目标时长：${duration}秒
画幅：${context.aspectRatio || "9:16"}

项目定义：
${context.projectDefinition || "未提供"}

项目圣经：
${context.projectBible || "未生成，请仅基于镜头和风格保持一致"}

视觉风格锁定词：
${visualStyle}

可用参考图：
${refList || "（无参考图）"}

请严格输出 JSON。`,
    responseFormat: {
      type: "json_schema",
      json_schema: {
        name: "seedance2_prompt_plan",
        strict: true,
        schema: {
          type: "object",
          properties: {
            finalPrompt: { type: "string" },
            shotType: { type: "string" },
            durationSec: { type: "integer" },
            beats: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  timeRange: { type: "string" },
                  purpose: { type: "string" },
                  performanceNote: { type: "string" },
                },
                required: ["timeRange", "purpose", "performanceNote"],
                additionalProperties: false,
              },
            },
            usedReferences: { type: "array", items: { type: "string" } },
            riskCheck: { type: "string" },
          },
          required: ["finalPrompt", "shotType", "durationSec", "beats", "usedReferences", "riskCheck"],
          additionalProperties: false,
        },
      },
    },
    temperature: 0.8,
  });

  try {
    const parsed = parseLlmJson<{ finalPrompt?: string }>(response, "Seedance 2.0 提示词");
    return (parsed.finalPrompt || response).trim();
  } catch {
    return response.trim();
  }
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
  style: string,
  context: ProjectPromptContext = {}
): Promise<string> {
  return callLLM({
    systemPrompt: STORYBOARD_SKETCH_SYSTEM,
    prompt: `请把以下镜头改写成 image2 分镜草图提示词：

项目风格：${style}
画幅：${context.aspectRatio || "9:16"}
项目圣经摘要：${context.projectBible || "未提供"}
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
  seedancePrompt?: string,
  context: ProjectPromptContext = {}
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
画幅：${context.aspectRatio || "9:16"}
项目圣经摘要：${context.projectBible || "未提供"}
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

  return parseLlmJson<FramePrompts>(response, "首尾帧提示词");
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
