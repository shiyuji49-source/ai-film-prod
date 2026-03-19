import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "../db";
import { publicProcedure, router } from "../_core/trpc";
import { ENV } from "../_core/env";
import { callClaudeSonnet, callClaudeOpus, CLAUDE_SONNET, CLAUDE_OPUS } from "../lib/vectorengine";
import {
  GEMINI_PRO_MODEL,
  GEMINI_FLASH_MODEL,
  GEMINI_THINKING_HIGH,
  GEMINI_THINKING_LOW,
  GEMINI_THINKING_OFF,
} from "../../shared/const";

// ─── 风格大类固定提示词映射 ────────────────────────────────────────────────────
// 每种大风格有严格固定的英文关键词组合，确保生成结果风格一致，不会随机漂移
const STYLE_FIXED_KEYWORDS: Record<string, { en: string; renderingNote: string }> = {
  "2D": {
    en: "2D animation style, hand-drawn illustration, flat color shading, cel shading, clean line art, anime style, 2D cartoon rendering",
    renderingNote: "【严格要求】这是2D动画风格，英文提示词必须包含上述固定关键词。禁止使用：3D rendering, photorealistic, subsurface scattering, ray tracing, CGI, volumetric lighting等写实3D词汇。",
  },
  "3D": {
    en: "3D CGI animation style, 3D rendered, volumetric lighting, physically based rendering, smooth 3D shading, cinematic 3D animation",
    renderingNote: "【严格要求】这是3D动画风格，英文提示词必须包含上述固定关键词。禁止使用：hand-drawn, flat color, cel shading, 2D illustration等2D风格词汇。",
  },
  "CG": {
    en: "CG cinematic style, photorealistic CGI, hyper-realistic 3D, cinematic visual effects, VFX quality, game engine render, Unreal Engine cinematic",
    renderingNote: "【严格要求】这是CG写实风格，英文提示词必须包含上述固定关键词，强调超写实质感和电影级视效。",
  },
  "真人": {
    en: "live action style, photographic realism, cinematic photography, real world setting, film photography, natural lighting, documentary style",
    renderingNote: "【严格要求】这是真人影视风格，英文提示词必须包含上述固定关键词，强调真实摄影感和电影质感。",
  },
};

// 根据 styleZh 或 styleEn 提取风格大类
function getStyleCategory(styleZh?: string, styleEn?: string): string {
  if (!styleZh && !styleEn) return "";
  const combined = `${styleZh || ""} ${styleEn || ""}`;
  if (combined.includes("2D") || combined.includes("二维")) return "2D";
  if (combined.includes("3D") || combined.includes("三维")) return "3D";
  if (combined.includes("CG") || combined.includes("写实")) return "CG";
  if (combined.includes("真人") || combined.includes("live action")) return "真人";
  return "";
}

// 获取固定风格关键词（用于嵌入提示词）
function getFixedStyleKeywords(styleZh?: string, styleEn?: string): { fixedEn: string; renderingNote: string; category: string } {
  const category = getStyleCategory(styleZh, styleEn);
  if (category && STYLE_FIXED_KEYWORDS[category]) {
    return { fixedEn: STYLE_FIXED_KEYWORDS[category].en, renderingNote: STYLE_FIXED_KEYWORDS[category].renderingNote, category };
  }
  return { fixedEn: styleEn || "", renderingNote: "", category: "" };
}

// ─── 全局视频提示词约束（无背景音乐/无字幕） ──────────────────────────────────
const GLOBAL_VIDEO_CONSTRAINTS = `
【全局约束（所有镜头必须遵守）】
- 全程无背景音乐（no background music, no BGM, no soundtrack）
- 画面内容无字幕（no subtitles, no text overlay, no captions, no on-screen text）
- 旁白（VO）仅作为画外音，不在画面中显示文字
`;

// ─── AI API Helpers (via VectorEngine → Claude) ──────────────────────────────
// Claude Sonnet 4.6: 剧本解析、分析等简单任务（原 callGeminiFlash）
// Claude Opus 4.6: 分镜提示词生成等复杂创意任务（原 callGeminiPro/callGeminiProCreative）

/** 剧本解析用：Claude Sonnet（速度快，适合结构化输出） */
const callGeminiFlash = (prompt: string, _maxOutputTokens = 65536) =>
  callClaudeSonnet([{ role: "user", content: prompt }], { max_tokens: _maxOutputTokens, temperature: 0.5 });

/** 分镜/视频提示词用：Claude Opus（适合逻辑推理类任务） */
const callGeminiPro = (prompt: string, _maxOutputTokens = 8192) =>
  callClaudeOpus([{ role: "user", content: prompt }], { max_tokens: _maxOutputTokens, temperature: 0.7 });

/** 资产提示词用：Claude Opus（感性创作，温度略高） */
const callGeminiProCreative = (prompt: string, _maxOutputTokens = 8192) =>
  callClaudeOpus([{ role: "user", content: prompt }], { max_tokens: _maxOutputTokens, temperature: 0.9 });

/** Legacy wrapper for backward compatibility */
async function callGemini(prompt: string, maxOutputTokens = 65536): Promise<string> {
  return callClaudeSonnet([{ role: "user", content: prompt }], { max_tokens: maxOutputTokens });
}

// Router -------------------------------------------------------------------

export const aiRouter = router({

  // 1. 剧本解析 --------------------------------------------------------------
  analyzeScript: publicProcedure
    .input(z.object({
      scriptText: z.string().min(10).max(200000),
      styleZh: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // 登录用户扣 1 积分
      if (ctx.user) {
        if (ctx.user.credits < 1) {
          throw new TRPCError({ code: "FORBIDDEN", message: "积分不足，无法解析剧本（需要 1 积分）" });
        }
        await db.deductCredits(ctx.user.id, 1, "analyze_script", undefined, "AI 解析剧本");
      }
      const prompt = `你是一位专业的影视制作人和剧本分析师。请仔细阅读以下剧本，进行结构化分析。

【分析规则】
1. 集数识别：
   - 忽略剧本开头的简介、序言、人物介绍、世界观说明等非正文内容（通常标注为"序章"、"前言"、"人物介绍"或EP-01等）
   - 从第一个真正的故事集数开始（通常是EP-02或第一集正文）
   - 每集提取：集数编号、标题、时长（分钟）、剧情简介（100字内）
   
2. 人物识别（全局，不分集）：
   - 只提取真实的角色名，包括人类角色和机甲/机器人角色
   - 严格排除：场景说明、舞台指示、"出场人物"、"一卡"、"旁白"、"解说"、"画外音"、"字幕"等非角色词
   - 同一角色去重，不要出现"张三（快乐）"和"张三（悲伤）"这样的重复，只保留"张三"
   - 每个角色分析：姓名、角色定位（主角/配角/反派等）、外貌特征（肤色/发型/脸型/体型等）、服装特征、是否为机甲/机器人
   - 机甲识别关键词：机甲、战甲、机器人、战机、机械体、AI战士等
   
3. 场景识别（按集）：
   - 每集提取主要场景：场景名称、环境类型（室内/室外/太空等）、时间（白天/夜晚/黄昏等）、氛围描述、视觉特征
   
4. 道具识别（按集）：
   - 每集提取重要道具：名称、外观描述、材质、用途
   - 道具范围包括：实体道具（武器、容器、工具等）和虚拟/界面类道具（系统面板、全息屏幕、数据界面、控制台、屏幕显示器、头盔显示屏等）
   - 对于界面类道具，材质写"虚拟光效"或"全息投影"，用途写具体功能（如显示战斗数据、导航界面等）

【剧本内容】
${input.scriptText.slice(0, 80000)}

【输出格式】严格输出以下JSON结构，不要有任何额外说明：
{
  "episodes": [
    {
      "id": "ep01",
      "number": 1,
      "title": "集数标题",
      "duration": 5,
      "synopsis": "剧情简介",
      "scenes": [
        {
          "name": "场景名称",
          "environment": "室内/室外/太空等",
          "timeOfDay": "白天/夜晚/黄昏/清晨",
          "atmosphere": "氛围描述，如：紧张压抑、温暖宁静",
          "visualFeatures": "视觉特征描述，如：霓虹灯光、废墟废墟、金属质感"
        }
      ],
      "props": [
        {
          "name": "道具名称",
          "appearance": "外观描述",
          "material": "材质",
          "purpose": "用途"
        }
      ]
    }
  ],
  "characters": [
    {
      "name": "角色名",
      "role": "主角/配角/反派/机甲/其他",
      "isMecha": false,
      "appearance": "详细外貌：肤色、发型、发色、脸型、眼睛、体型、年龄感等",
      "costume": "服装描述：颜色、款式、材质、特殊标志等",
      "marks": "特殊标记：伤疤、纹身、特殊装备等（无则留空）",
      "personality": "性格特点（简短）"
    }
  ]
}`;

      const raw = await callGeminiProCreative(prompt, 65536);
      const cleaned = raw.replace(/^```json\s*/m, "").replace(/^```\s*/m, "").replace(/```\s*$/m, "").trim();
      const parsed = JSON.parse(cleaned) as {
        episodes: Array<{
          id: string; number: number; title: string; duration: number; synopsis: string;
          scenes: Array<{ name: string; environment: string; timeOfDay: string; atmosphere: string; visualFeatures: string }>;
          props: Array<{ name: string; appearance: string; material: string; purpose: string }>;
        }>;
        characters: Array<{
          name: string; role: string; isMecha: boolean; appearance: string;
          costume: string; marks: string; personality: string;
        }>;
      };
      return parsed;
    }),

  // 2. 生成人物 MJ7 提示词 ----------------------------------------------------
  generateCharacterPrompt: publicProcedure
    .input(z.object({
      name: z.string(),
      role: z.string(),
      isMecha: z.boolean(),
      isQVersion: z.boolean().optional(),
      appearance: z.string(),
      costume: z.string(),
      marks: z.string().optional(),
      styleZh: z.string().optional(),
      styleEn: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { name, isMecha, isQVersion, appearance, costume, marks, styleZh, styleEn } = input;

      // 获取固定风格关键词（严格固定，不允许 AI 自由发挥风格）
      const { fixedEn: fixedStyleEn, renderingNote, category } = getFixedStyleKeywords(styleZh, styleEn);
      const styleEnStr = fixedStyleEn
        ? `\n- 【固定风格关键词，必须原样嵌入英文提示词中，不得修改或替换】：${fixedStyleEn}`
        : "";

      const prompt = isMecha
        ? `你是专业的AI影片制作提示词工程师。请为以下机甲角色生成一张用于 Midjourney 7（MJ7）的竖版单张参考图提示词。

【机甲信息】
名称：${name}
外观特征：${appearance}
装甲/外壳：${costume}
特殊标记：${marks || "无"}
整体风格：${styleZh || "科幻机甲风格"}（风格大类：${category || "未指定"}）

【MJ7提示词要求】
- 生成一张竖版（2:3比例）的机甲全身参考图
- 纯黑色背景，蓝图辅助线风格
- 正面视角，全身展示，清晰展现机甲结构
- 强调金属质感、能量核心、装甲分层
- 中文提示词：详细描述机甲外观，包含材质、光效、科技感
- 英文提示词：对应的英文版本，用于直接输入MJ7${styleEnStr}
- 英文提示词末尾加上：--ar 2:3 --style raw --q 2
- 不要出现@符号，不要引用具体作品名称
${renderingNote}

请严格输出以下输出格式：
{
  "zh": "中文提示词内容",
  "en": "English prompt content --ar 2:3 --style raw --q 2"
}`
        : `你是专业的AI影片制作提示词工程师。请为以下角色生成一张用于 Midjourney 7（MJ7）的竖版单张人物形象参考图提示词。

【角色信息】
姓名：${name}
外貌特征：${appearance}
服装描述：${costume}
特殊标记：${marks || "无"}
整体风格：${styleZh || ""}（风格大类：${category || "未指定"}）

【MJ7提示词要求】
- 生成一张竖版（2:3比例）的人物全身形象参考图
- 干净的深灰色渐变背景
- 正面站姿，全身展示，面部清晰可见
- 强调人物气质、服装细节、面部特征
- 中文提示词：详细描述人物外貌、服装、神态、光线
- 英文提示词：对应的英文版本，用于直接输入MJ7${styleEnStr}
- 英文提示词末尾加上：--ar 2:3 --style raw --q 2
- 不要出现@符号，不要引用具体作品名称
${renderingNote}

请严格输出以下输出格式：
{
  "zh": "中文提示词内容",
  "en": "English prompt content --ar 2:3 --style raw --q 2"
}`;

      // 如果需要 Q 版形象，同时生成 Q 版提示词
      let qVersionZh = "";
      let qVersionEn = "";
      if (isQVersion && !isMecha) {
        const qPrompt = `你是专业的AI影片制作提示词工程师。请为以下角色生成一张用于 Midjourney 7（MJ7）的 Q 版形象参考图提示词。

【角色信息】
姓名：${name}
外貌特征：${appearance}
服装描述：${costume}
特殊标记：${marks || "无"}
整体风格：${styleZh || ""}（风格大类：${category || "未指定"}）

【MJ7提示词要求】
- 生成一张竖版（2:3比例）的 Q 版全身形象参考图
- Q 版风格特征：大头小身（头身比大约 1:2）、圆润可爱的脸型、大眼睛、简化的身体比例
- 保持角色的服装颜色、发型、标志性特征与正常形象一致
- 纯白色背景，工作室光线
- 中文提示词：详细描述 Q 版形象的大头小身风格、服装、表情
- 英文提示词：对应的英文版本，用于直接输入MJ7${fixedStyleEn ? `\n- 【固定风格关键词，必须原样嵌入】：${fixedStyleEn}` : ""}
- 英文提示词末尾加上：--ar 2:3 --style raw --q 2
- 不要出现@符号，不要引用具体作品名称
${renderingNote}

请严格输出以下输出格式：
{
  "zh": "中文提示词内容",
  "en": "English prompt content --ar 2:3 --style raw --q 2"
}`;
        try {
          const qRaw = await callGeminiProCreative(qPrompt);
          const qCleaned = qRaw.replace(/^```json\s*/m, "").replace(/^```\s*/m, "").replace(/```\s*$/m, "").trim();
          const qParsed = JSON.parse(qCleaned) as { zh: string; en: string };
          qVersionZh = qParsed.zh;
          qVersionEn = qParsed.en;
        } catch {
          // Q 版生成失败不影响主要提示词
        }
      }

      const raw = await callGeminiProCreative(prompt);
      const cleaned = raw.replace(/^```json\s*/m, "").replace(/^```\s*/m, "").replace(/```\s*$/m, "").trim();
      const parsed = JSON.parse(cleaned) as { zh: string; en: string };
      return { ...parsed, qVersionZh: qVersionZh || undefined, qVersionEn: qVersionEn || undefined };
    }),

  // 3. 生成场景/道具 MJ7 提示词 ----------------------------------------------
  generateAssetPrompt: publicProcedure
    .input(z.object({
      type: z.enum(["scene", "prop", "scene_quad"]),
      name: z.string(),
      description: z.string(),
      episodeContext: z.string().optional(),
      styleZh: z.string().optional(),
      styleEn: z.string().optional(),
      orientation: z.enum(["landscape", "portrait"]).optional(), // 画幅方向
    }))
    .mutation(async ({ input }) => {
      const { type, name, description, episodeContext, styleZh, styleEn, orientation } = input;

      const isPortrait = orientation === "portrait";

      // 根据画幅确定比例
      const aspectRatio = isPortrait ? "9:16" : "16:9";
      const compositionNote = isPortrait
        ? "竖版（9:16比例）构图，纵向空间感，适合竖屏播放"
        : "横版（16:9比例）构图，宽画幅电影感，适合横屏播放";

      // 获取固定风格关键词
      const { fixedEn: fixedStyleEn, renderingNote, category } = getFixedStyleKeywords(styleZh, styleEn);
      const styleEnStr = fixedStyleEn
        ? `\n- 【固定风格关键词，必须原样嵌入英文提示词中，不得修改或替换】：${fixedStyleEn}`
        : "";

      // ─── 普通场景 MJ7 提示词（STEP 1 用，展示给用户，用于 MJ 生成参考图）────────
      const scenePrompt = `你是专业的AI影片制作提示词工程师。请为以下场景生成用于 Midjourney 7（MJ7）的场景参考图提示词。

【场景信息】
场景名称：${name}
场景描述：${description}
所在集数背景：${episodeContext || ""}
整体风格：${styleZh || ""}（风格大类：${category || "未指定"}）
画幅方向：${compositionNote}

【MJ7提示词要求】
- 生成一张${compositionNote}的场景参考图
- 展示场景的整体环境、氛围、光线、色调
- 无人物，专注于场景本身的视觉表现
- 中文提示词：详细描述场景的环境、光线、色调、氛围、视觉特征
- 英文提示词：对应的英文版本，用于直接输入MJ7${styleEnStr}
- 英文提示词末尾加上：--ar ${aspectRatio} --style raw --q 2
- 不要出现@符号，不要引用具体作品名称
${renderingNote}

请严格输出以下JSON格式：
{
  "zh": "中文提示词内容",
  "en": "English prompt content --ar ${aspectRatio} --style raw --q 2"
}`;

      // ─── 场景四宫格四方向视图提示词（STEP 3 内部静默调用，不展示给用户）──────────
      const gridLayoutNote = isPortrait
        ? "输出一张四宫格图片（竖版9:16总画幅），四格之间有清晰黑色分割线，四格内容区域彼此相邻，禁止出现分割线以外的额外黑色外框、黑色留边或大块黑色间隔"
        : "输出四张图片，根据不同画幅，16:9可以为2x2四格内容区域彼此相邻，禁止出现分割线以外的额外黑色外框、黑色留边或大块黑色间隔";

      const styleNoteForScene = category === "真人"
        ? "图片风格：参考院线电影，真人电影风格，影视大片，真实透视比例，真实皮肤质感，细节清晰不过度锐化"
        : category === "2D"
        ? "图片风格：2D动画风格，平面插画，干净线条，赛璐璐着色，无纹理，统一色调"
        : category === "3D"
        ? "图片风格：3D CGI动画风格，体积光照，物理渲染，平滑3D着色，电影级3D动画"
        : category === "CG"
        ? "图片风格：CG电影风格，超写实CGI，电影级视觉特效，VFX质量，虚幻引擎电影渲染"
        : "图片风格：参考院线电影，影视大片，真实透视比例，细节清晰";

      const sceneQuadPrompt = `你是专业的AI影片制作提示词工程师。请根据以下场景信息，严格按照模板格式，为该场景生成用于 Gemini 3 Pro Image 的四宫格四方向视图提示词。

【场景信息】
场景名称：${name}
场景描述：${description}
所在集数背景：${episodeContext || ""}
整体风格：${styleZh || ""}（风格大类：${category || "未指定"}）
画幅方向：${compositionNote}

【严格模板格式说明】
你必须严格按照以下模板结构输出，只替换【场景特征描述】和【四个视角】中的具体内容，其余固定文本不得修改：

---模板开始---
画面内容：${gridLayoutNote}，展示同一空间的四个方向关联视图，四张图来自同一空间布局与同一个空间中心点，四个方向全部为正面平视视角，相机高度1.6m，焦距35mm，景别为全景，四格景别一致，地面连续一致，材质一致，光线方向一致，不出现人物。画面中不出现任何文字、标注、箭头、编号、水印、UI元素；
场景特征描述：【根据场景信息填写：时代背景·地域，时间段，天气，季节，日期类型。正面方向为xxx，地面为xxx，背面方向为xxx，左侧区域为xxx，右侧区域为xxx，空间中心点位于xxx】；
四个视角：
* 左上角正面视角，主要视觉为【正面主要视觉元素】，纯立面正视全景，画面左侧为【左侧边缘元素】，画面右侧为【右侧边缘元素】；
* 右上角反打视角，推测出左上角图片的反打镜头，主要视觉为【正面对面方向的视觉元素】，纯立面正视全景，画面左侧为【反打左侧元素】，画面右侧为【反打右侧元素】；
* 左下角左侧面视角，为左上角图片向左旋转90度方向，主要视觉为【左侧方向的视觉元素】，纯立面正视全景；
* 右下角右侧面视角，为左上角图片向右旋转90度方向，主要视觉为【右侧方向的视觉元素】，纯立面正视全景。
${styleNoteForScene}；
---模板结束---

【输出要求】
- 中文提示词：完整填写上述模板，替换所有【】中的内容为该场景的具体描述
- 英文提示词：将中文提示词完整翻译为英文，保持相同结构${styleEnStr}
- 英文提示词末尾加上：--ar ${aspectRatio} --style raw --q 2
- 禁止出现@符号，禁止引用具体作品名称
${renderingNote}

请严格输出以下JSON格式：
{
  "zh": "完整中文四宫格提示词（按模板填写）",
  "en": "Complete English four-view prompt --ar ${aspectRatio} --style raw --q 2"
}`;

      // 根据 type 选择对应的 prompt
      const prompt = type === "scene"
        ? scenePrompt
        : type === "scene_quad"
        ? sceneQuadPrompt
        : `你是专业的AI影片制作提示词工程师。请为以下道具生成用于 Midjourney 7（MJ7）的道具展示图提示词。

【道具信息】
道具名称：${name}
道具描述：${description}
所在集数背景：${episodeContext || ""}
整体风格：${styleZh || ""}（风格大类：${category || "未指定"}）
画幅方向：${compositionNote}

【MJ7提示词要求】
- 生成一张${compositionNote}的道具展示图
- 纯黑色或深色背景，产品展示风格
- 清晰展示道具的外观、材质、细节
- 中文提示词：详细描述道具的外观、材质、光泽、特殊效果
- 英文提示词：对应的英文版本，用于直接输入MJ7${styleEnStr}
- 英文提示词末尾加上：--ar ${aspectRatio} --style raw --q 2
- 不要出现@符号，不要引用具体作品名称
${renderingNote}

请严格输出以下输出格式：
{
  "zh": "中文提示词内容",
  "en": "English prompt content --ar ${aspectRatio} --style raw --q 2"
}`;

      const raw = await callGeminiProCreative(prompt);
      const cleaned = raw.replace(/^```json\s*/m, "").replace(/^```\s*/m, "").replace(/```\s*$/m, "").trim();
      const parsed = JSON.parse(cleaned) as { zh: string; en: string };
      return parsed;
    }),

  // 4. AI 分镜生成 ------------------------------------------------------
  generateShots: publicProcedure
    .input(z.object({
      episodeTitle: z.string(),
      episodeNumber: z.number(),
      episodeSynopsis: z.string(),
      durationMinutes: z.number().min(1).max(30),
      scenes: z.array(z.string()),
      characters: z.array(z.string()),
      styleZh: z.string().optional(),
      styleEn: z.string().optional(),
      orientation: z.enum(["landscape", "portrait"]).optional(),
      market: z.string().optional(), // 目标市场
      episodeScript: z.string().optional(), // 当集原剧本文本
    }))
    .mutation(async ({ input, ctx }) => {
      // 分镜数量：大概范围，不严格限制，避免为凑数杜撰镜头
      // 参考值：每分钟约15-25个镜头，但以剧本内容为准
      const minShots = Math.round(input.durationMinutes * 12);
      const maxShots = Math.round(input.durationMinutes * 28);
      const refShots = Math.round(input.durationMinutes * 20);
      const creditCost = Math.min(refShots, 60);

      // 登录用户按参考镜头数扣积分
      if (ctx.user) {
        if (ctx.user.credits < creditCost) {
          throw new TRPCError({ code: "FORBIDDEN", message: `积分不足，生成分镜需要约 ${creditCost} 积分（当前 ${ctx.user.credits}）` });
        }
        await db.deductCredits(ctx.user.id, creditCost, "generate_shot", undefined, `AI 生成分镜（约${refShots}个）`);
      }

      const { episodeTitle, episodeNumber, episodeSynopsis, durationMinutes, scenes, characters, styleZh, styleEn, orientation, market, episodeScript } = input;

      // 根据市场确定配音语言
      const marketLangMap: Record<string, string> = {
        "中国": "普通话配音/旁白",
        "美国": "English dubbing/narration (English voiceover)",
        "日本": "Japanese dubbing/narration (日本語吹き替え)",
        "印度": "Hindi dubbing/narration",
        "俄罗斯": "Russian dubbing/narration (русская озвучка)",
        "韩国": "Korean dubbing/narration (한국어 더빙)",
        "法国": "French dubbing/narration",
        "德国": "German dubbing/narration",
        "西班牙": "Spanish dubbing/narration",
        "巴西": "Portuguese dubbing/narration",
      };
      const voLang = market ? (marketLangMap[market] || `${market}语配音/旁白`) : "普通话配音/旁白";

      // 获取固定风格关键词
      const { fixedEn: fixedStyleEn, renderingNote, category } = getFixedStyleKeywords(styleZh, styleEn);

      // 画幅视听语言方案
      const isPortrait = orientation === "portrait";
      const orientationNote = isPortrait
        ? "【竖屏视听语言】画幅9:16竖版，优先使用：特写/近景（展示面部情绪）、垂直运镜（上下移动）、中心构图、人物占满画幅高度，避免大远景和横向宽画幅构图"
        : "【横屏视听语言】画幅16:9横版，优先使用：宽画幅构图、横向运镜（左右移动）、双人/群像镜头、大远景展示环境，充分利用横向空间";

      const scriptSection = episodeScript
        ? `\n\n【原剧本内容（必须严格遵循，禁止添加原剧本没有的内容）】\n${episodeScript.slice(0, 40000)}`
        : "";

      const prompt = `你是专业的影视导演和分镜师。请根据以下剧本信息，为第${episodeNumber}集生成分镜表。

【剧本信息】
集数标题：${episodeTitle}
剧情简介：${episodeSynopsis}
单集时长：${durationMinutes}分钟
主要场景：${scenes.join('、')}
出场人物：${characters.join('、')}
整体风格：${styleZh || ''}（风格大类：${category || "未指定"}，固定关键词：${fixedStyleEn || "无"}）
目标市场：${market || "中国"}（配音语言：${voLang}）
${orientationNote}${scriptSection}

【分镜生成规则】
1. 镜头数量参考范围：约${minShots}~${maxShots}个（参考值${refShots}个）
   - 【重要】不要为了凑够镜头数量而杜撰剧情，镜头数量以完整呈现原剧本内容为准
   - 如果原剧本内容较少，可以少于参考范围；如果内容丰富，可以适当超出
   - 禁止凭空添加原剧本中没有的场景、人物、事件、对白
2. 每个镜头时长：2-5秒，高燃场景用短镜头（2-3秒），转场和平静场景用长镜头（4-5秒）
3. 镜头类型分配：定场镜头(10%) 逻辑镜头(20%) Action镜头(35%) Reaction镜头(25%) 旁跳镜头(10%)
4. 情绪节奏：开头平静铺垫，中段逐渐升温，高潮点爆发，结尾余韵收尾
5. 【最重要】原剧本中有三种旁白/对白格式，必须全部识别并一字不改地保留到对应镜头：
   - 「VO：」 开头 → 旁白（画面外第三方旁白），写入 vo 字段
   - 「人物名/系统VO：」 开头 → 内心独白（人物内心独白），写入 vo 字段，格式：「[人物名内心独白]」
   - 「人物名/系统：」 开头 → 对话台词，写入 dialogue 字段，格式：「人物名：“台词内容”」
   - 同一镜头内可能同时有 vo（旁白）和 dialogue（对话），两者均不得遗漏
6. 【最重要】台词对白必须严格按照原剧本原文，不得改写、浓缩、添加任何内容
7. 画面描述（description）可以在原剧本场景基础上补充镜头语言细节（如光效、构图、运动方式），但不得虚构剧情事件
8. 不得删除、合并、改写原剧本中的任何场景、人物、事件
9. 每个动作镜头应有具体的音效描述（SFX）
10. 【时间操控镜头】如剧本中有明确指示，必须使用对应镜头类型：
    - 慢镜头/超慢镜头：拉伸时间，适用于战斗高潮、爆炸瞬间、英雄亮相等关键时刻
    - 延时镜头：压缩时间，适用于时间流逝、季节更替、城市变迁等长时间变化
    - 定格镜头：画面静止，适用于关键决定瞬间、高潮动作定格
    - 快镜头：加速播放，适用于紧迫准备过程、喜剧段落
    - 逆向镜头：画面倒放，适用于记忆回溯、梦境序列
11. 【视角镜头】根据叙事需要合理使用：航拍镜头（宏大场景）、俯视镜头（孤立感）、仰视镜头（威严登场）、荷兰角（心理扭曲）
${renderingNote}

请严格输出以下 JSON格式，不要有任何额外说明：
{
  "shots": [
    {
      "number": 1,
      "type": "定场镜头|主镜头|过肩镜头|特写镜头|大特写|反应镜头|插入镜头|空镜头|主观镜头|跟拍镜头|双人镜头|群像镜头|平行剪辑镜头|慢镜头|超慢镜头|延时镜头|快镜头|定格镜头|逆向镜头|航拍镜头|俯视镜头|仰视镜头|荷兰角镜头|过肩俯拍",
      "size": "极远景|远景|全景|中景|中近景|近景|特写",
      "movement": "固定镜头|推镜头|拉镜头|横移|垂直摇|跟拍|环绕|手持抖动|升降镜头|俯冲镜头|航拍运动|稳定器滑轨|变焦推拉|吊臂镜头|滑轨镜头|甩镜头|第一人称镜头",
      "description": "具体的画面内容描述，包含人物动作和场景氛围",
      "vo": "旁白或内心独白：直接摘取原剧本中 'VO:' 开头的旁白或 '人物名VO:' 开头的内心独白原文，无则留空",
      "dialogue": "对话台词：直接摘取原剧本中 '人物名:' 开头的对话原文，格式 '人物名:“台词”'，无则留空",
      "sfx": "音效描述，无则留空",
      "duration": 3,
      "emotion": "情绪关键词",
      "emotionLevel": 3
    }
  ]
}`;

      const raw = await callGeminiPro(prompt, 65536);
      const cleaned = raw.replace(/^```json\s*/m, "").replace(/^```\s*/m, "").replace(/```\s*$/m, "").trim();
      const parsed = JSON.parse(cleaned) as {
        shots: Array<{
          number: number; type: string; size: string; movement: string;
          description: string; vo: string; dialogue: string; sfx: string;
          duration: number; emotion: string; emotionLevel: number;
        }>;
      };
      return parsed;
    }),

  // 5. Seedance 多镜头提示词生成 -------------------------------------------
  generateVideoPrompt: publicProcedure
    .input(z.object({
      shots: z.array(z.object({
        number: z.number(),
        type: z.string(),
        size: z.string(),
        movement: z.string(),
        description: z.string(),
        vo: z.string(),
        dialogue: z.string().optional(), // 对话台词
        sfx: z.string(),
        duration: z.number(),
        emotion: z.string(),
        emotionLevel: z.number(),
      })),
      totalDuration: z.number(),
      styleZh: z.string().optional(),
      styleEn: z.string().optional(),
      orientation: z.enum(["landscape", "portrait"]).optional(),
      market: z.string().optional(),
      episodeContext: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // 登录用户扣 3 积分/条
      if (ctx.user) {
        if (ctx.user.credits < 3) {
          throw new TRPCError({ code: "FORBIDDEN", message: "积分不足，生成视频提示词需要 3 积分" });
        }
        await db.deductCredits(ctx.user.id, 3, "generate_prompt", undefined, "AI 生成 Seedance 视频提示词");
      }
      const { shots, totalDuration, styleZh, styleEn, orientation, market, episodeContext } = input;

      // 获取固定风格关键词
      const { fixedEn: fixedStyleEn, renderingNote, category } = getFixedStyleKeywords(styleZh, styleEn);

      // 画幅视听语言方案
      const isPortrait = orientation === "portrait";
      const orientationPromptNote = isPortrait
        ? "【竖屏9:16】所有镜头描述必须体现竖版构图：人物居中、特写优先、垂直运镜、纵向空间感"
        : "【横屏16:9】所有镜头描述必须体现横版构图：宽画幅、横向运镜、场景环境充分展示";

      // 根据市场确定配音语言
      const marketLangMap: Record<string, string> = {
        "中国": "普通话",
        "美国": "English",
        "日本": "日本語",
        "印度": "Hindi",
        "俄罗斯": "русский",
        "韩国": "한국어",
        "法国": "Français",
        "德国": "Deutsch",
        "西班牙": "Español",
        "巴西": "Português",
      };
      const voLang = market ? (marketLangMap[market] || market) : "普通话";

      const shotsDesc = shots.map(s =>
        `镜头${s.number}[类型:${s.type} 景别:${s.size} 运动:${s.movement} 时长:${s.duration}s 情绪:${s.emotion}(${s.emotionLevel}/5)]
  画面: ${s.description}
  VO/独白: ${s.vo || '无'}
  对话: ${s.dialogue || '无'}
  SFX: ${s.sfx || '无'}`
      ).join('\n');

      const prompt = `你是专业的AI影片提示词工程师。请为以下分镜组合生成一段用于即梦Seedance 1.5 Pro全能参考模式的多镜头视频提示词。

【分镜信息】
${shotsDesc}

【视频规格】
- 片段时长：${totalDuration}秒（${shots.length}个镜头）
- 整体风格：${styleZh || ''}（风格大类：${category || "未指定"}，固定关键词：${fixedStyleEn || "无"}）
- 剧情背景：${episodeContext || ''}
- 目标市场：${market || "中国"}（旁白语言：${voLang}）
${orientationPromptNote}
${GLOBAL_VIDEO_CONSTRAINTS}

【Seedance提示词规则】
1. 按镜头顺序描述，每个镜头明确标注景别、运动方式、时长
2. 画面描述具体生动，包含人物动作、表情、光效、场景氛围
3. 旁白/对话/独白必须全部保留并写入提示词，一字不改：
   - VO/独白字段有内容时：格式 [VO: "旁白或内心独白内容"]
   - 对话字段有内容时：格式 [对话: "人物名：台词内容"]
   - 音效字段有内容时：格式 [SFX: 音效描述]
   - 同一镜头内 VO/独白和对话可能同时存在，两者均不得遗漏
4. 不要出现@符号
5. 不要引用具体影视作品名称，用风格描述词代替
6. 提示词全程用中文撰写，不要在提示词中加入英文
7. 整体语调要具有电影感和沉浸感
8. 【全程无背景音乐，画面内容无字幕】——这是硬性要求，必须在提示词中明确标注
9. 【禁止添加原剧本没有的内容】——所有画面描述必须基于分镜信息，不得凭空添加场景、人物、事件
10. 【时间操控镜头必须明确标注】
   - 慢镜头：写明"慢动作""慢动作特写""子弹时间拉伸"等，并标注播放速度（如"1/4速"）
   - 超慢镜头：写明"超高速摄影慢播""1/8速慢动作"，强调光影粒子细节
   - 延时镜头：写明"延时摄影""时间加速流逝"，描述快速变化的天空、人流、光线
   - 定格镜头：写明"画面定格""动作冻结"，描述定格瞬间的构图与情绪
   - 逆向镜头：写明"画面倒放""时间倒流"，描述倒连的动作或场景
11. 【特殊运镜必须说明】
   - 变焦推拉：写明"镜头推进同时背景向后拉伸"，强调心理震撼效果
   - 甩镜头：写明"极速横移转场"，画面模糊带入下一场景
   - 航拍运动：写明"无人机俯瞰""高空俯瞰"，展示地理全貌
${renderingNote}

请直接输出提示词文本，不要有任何额外说明或JSON包裹。`;

      const raw = await callGeminiPro(prompt);
      const cleaned = raw.replace(/^```[\w]*\s*/m, "").replace(/```\s*$/m, "").trim();
      return { prompt: cleaned };
    }),

  // ═══════════════════════════════════════════════════════════════════════
  // 精品剧工作流 — 三阶段 AI 路由
  // ═══════════════════════════════════════════════════════════════════════

  // 7. 精品剧 — 导演分析（阶段一）──────────────────────────────────────────
  premiumDirectorAnalysis: publicProcedure
    .input(z.object({
      scriptText: z.string().min(10).max(200000),
      episodeNumber: z.number().min(1),
      styleZh: z.string().optional(),
      existingCharacters: z.array(z.string()).optional(), // 已有人物名（用于标记复用/变体）
      existingScenes: z.array(z.string()).optional(),     // 已有场景名
    }))
    .mutation(async ({ input }) => {
      const { scriptText, episodeNumber, styleZh, existingCharacters, existingScenes } = input;
      const epTag = `ep${String(episodeNumber).padStart(2, '0')}`;

      const existingCharsNote = existingCharacters?.length
        ? `\n已有人物素材：${existingCharacters.join('、')}（如果本集出场且外观无变化，素材状态标记为"复用"；外观有变化标记为"变体"并注明差异）`
        : '';
      const existingScenesNote = existingScenes?.length
        ? `\n已有场景素材：${existingScenes.join('、')}（如果本集出现且环境无变化，素材状态标记为"复用"；有变化标记为"变体"）`
        : '';

      const prompt = `你是一位专业的影视导演。请对以下剧本进行导演分析，产出导演讲戏本、人物清单和场景清单。

【分析原则】
- 导演意图优先：你是在给演员和摄影团队讲戏，用自然流畅的叙述融合所有维度
- 每个剧情点 = 一段完整叙事 = 一次 Seedance 1.5 Pro 生成任务
- 段落内可包含多组镜头（如蒙太奇、快速闪回），但叙事上必须是一个完整段落
- 节拍密度约束：1拍 ≈ 2.5秒，不要在短时间内塞入过多动作
- 头尾安全区：每段视频前0.5s和后0.5s不放关键内容

【剧本内容（第${episodeNumber}集）】
${scriptText.slice(0, 80000)}

整体风格：${styleZh || '未指定'}${existingCharsNote}${existingScenesNote}

【产出要求】

一、导演讲戏本
将剧本拆分为多个剧情点（P01、P02...），每个剧情点包含：
- 人物：出场人物
- 场景：场景名（多场景段落用顿号分隔）
- 镜头组：单镜头 / 多镜头（X组）
- 时长建议：5s/8s/10s/15s
- 导演阐述：完整的画面描述，包含走位、动作、台词、镜头感觉、光影氛围。像给演员讲戏一样，把脑海中的影像说出来。多镜头段落还需描述镜头切换方式、子画面节奏、整段叙事弧线。

二、人物清单
只列入需要参考图的角色（主要人物 + 多镜头出场的角色），群演不列入。
每个角色需要：人物名、年龄、外观关键词（发型/脸型/体型/服装/气质）、素材状态（新增/复用/变体）

三、场景清单
每个场景需要：场景名、时间（白天/夜晚/黄昏等）、光线/色调、氛围关键词、素材状态（新增/复用/变体）

【输出格式】严格输出以下JSON：
{
  "plotPoints": [
    {
      "id": "P01",
      "title": "剧情标题",
      "characters": ["人物1", "人物2"],
      "scene": "场景名",
      "shotGroup": "单镜头",
      "durationSuggestion": "8s",
      "directorNotes": "导演阐述完整内容..."
    }
  ],
  "characters": [
    {
      "name": "人物名",
      "age": "28",
      "appearanceKeywords": "干练短发、鹅蛋脸、职业西装",
      "assetStatus": "新增",
      "assetRef": ""
    }
  ],
  "scenes": [
    {
      "name": "场景名",
      "time": "深夜",
      "lightingTone": "冷白荧光灯、暗蓝",
      "atmosphereKeywords": "冷清、压抑",
      "assetStatus": "新增",
      "assetRef": ""
    }
  ]
}`;

      const raw = await callGeminiPro(prompt, 65536);
      const cleaned = raw.replace(/^```json\s*/m, '').replace(/^```\s*/m, '').replace(/```\s*$/m, '').trim();
      return JSON.parse(cleaned);
    }),

  // 8. 精品剧 — 人物提示词生成（服化道阶段）────────────────────────────────────
  premiumCharacterPrompt: publicProcedure
    .input(z.object({
      name: z.string(),
      age: z.string(),
      appearanceKeywords: z.string(),
      assetStatus: z.string(), // 新增/复用/变体
      episodeTag: z.string(),  // ep01
      styleZh: z.string().optional(),
      variationNote: z.string().optional(), // 变体说明
    }))
    .mutation(async ({ input }) => {
      const { name, age, appearanceKeywords, assetStatus, episodeTag, styleZh, variationNote } = input;

      const variationSection = assetStatus === '变体' && variationNote
        ? `\n\n【变体说明】这是已有人物的变体版本。差异：${variationNote}\n请在提示词中保持原有人物特征，仅修改差异部分。`
        : '';

      const prompt = `你是专业的影视美术设计师。请为以下角色生成一张人物设定参考图的提示词。

【角色信息】
人物名：${name}
年龄：${age}
外观关键词：${appearanceKeywords}
素材状态：${assetStatus}（${episodeTag}）
整体风格：${styleZh || '未指定'}${variationSection}

【出图要求】
一张图，左半边是面部特写，右半边是全身正面、侧面、背面设定图（三视图），白色背景。

【提示词规范】
- 叙事描述式，不要关键词堆叠
- 包含：年龄、五官细节（眼型/鼻型/嘴型/肤色）、体型、发型/发色、服装款式/颜色/材质、配饰、鞋子、整体气质
- 明确左半边面部特写 + 右半边三视图的布局要求
- 提示词必须完整可用，用户可直接复制到文生图工具
- 中文提示词

请严格输出以下JSON格式：
{
  "zh": "完整的中文提示词",
  "en": "完整的英文提示词（用于 MJ/DALL-E 等英文工具）",
  "layoutNote": "左半面部特写 + 右半三视图"
}`;

      const raw = await callGeminiProCreative(prompt);
      const cleaned = raw.replace(/^```json\s*/m, '').replace(/^```\s*/m, '').replace(/```\s*$/m, '').trim();
      return JSON.parse(cleaned);
    }),

  // 9. 精品剧 — 场景提示词生成（单张出，不用九宫格）────────────────────────────
  premiumScenePrompt: publicProcedure
    .input(z.object({
      name: z.string(),
      time: z.string(),
      lightingTone: z.string(),
      atmosphereKeywords: z.string(),
      assetStatus: z.string(),
      episodeTag: z.string(),
      styleZh: z.string().optional(),
      variationNote: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { name, time, lightingTone, atmosphereKeywords, assetStatus, episodeTag, styleZh, variationNote } = input;

      const variationSection = assetStatus === '变体' && variationNote
        ? `\n\n【变体说明】差异：${variationNote}`
        : '';

      const prompt = `你是专业的影视美术设计师。请为以下场景生成一张单独的场景参考图提示词。

【场景信息】
场景名：${name}
时间：${time}
光线/色调：${lightingTone}
氛围关键词：${atmosphereKeywords}
素材状态：${assetStatus}（${episodeTag}）
整体风格：${styleZh || '未指定'}${variationSection}

【出图要求】
单独一张场景图（不是九宫格），展示场景的完整环境。

【提示词规范】
- 叙事描述式，不要关键词堆叠
- 包含：视角、空间布局、光源与光线方向、色调、关键道具/家具/物件、氛围情绪
- 融合为流畅段落，像描述一个电影画面
- 无人物，专注于场景本身
- 提示词必须完整可用，用户可直接复制到文生图工具
- 中文提示词

请严格输出以下JSON格式：
{
  "zh": "完整的中文场景提示词",
  "en": "完整的英文场景提示词",
  "keyVisualElement": "这个场景的核心视觉元素"
}`;

      const raw = await callGeminiProCreative(prompt);
      const cleaned = raw.replace(/^```json\s*/m, '').replace(/^```\s*/m, '').replace(/```\s*$/m, '').trim();
      return JSON.parse(cleaned);
    }),

  // 10. 精品剧 — Seedance 1.5 Pro 提示词生成（分镜阶段）──────────────────────────
  premiumSeedancePrompt: publicProcedure
    .input(z.object({
      plotPoint: z.object({
        id: z.string(),
        title: z.string(),
        characters: z.array(z.string()),
        scene: z.string(),
        shotGroup: z.string(),
        durationSuggestion: z.string(),
        directorNotes: z.string(),
      }),
      // 素材对应表：告诉 AI 哪些 @图片 对应哪些人物/场景
      assetMapping: z.array(z.object({
        refId: z.string(),       // @图片1
        type: z.string(),        // 人物参考 / 场景参考
        name: z.string(),        // 林薇 / 办公室
      })),
      styleZh: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { plotPoint, assetMapping, styleZh } = input;

      // 构建素材对应表文本
      const assetTable = assetMapping.map(a => `${a.refId} → ${a.type}：${a.name}`).join('\n');

      // 解析时长建议为秒数
      const durationMatch = plotPoint.durationSuggestion.match(/(\d+)/);
      const durationSec = durationMatch ? parseInt(durationMatch[1]) : 8;
      const useTimeSections = durationSec >= 10;

      const prompt = `你是专业的 Seedance 1.5 Pro 分镜师。请根据导演讲戏本，为以下剧情点生成 Seedance 1.5 Pro 视频提示词。

【素材对应表】
${assetTable}

【剧情点信息】
编号：${plotPoint.id}
标题：${plotPoint.title}
出场人物：${plotPoint.characters.join('、')}
场景：${plotPoint.scene}
镜头组：${plotPoint.shotGroup}
时长建议：${plotPoint.durationSuggestion}
整体风格：${styleZh || '未指定'}

【导演阐述】
${plotPoint.directorNotes}

【Seedance 1.5 Pro 提示词方法论】

1. 叙事描述式：用完整段落描述，像写电影脚本，不要关键词堆叠
2. 参考图已见原则：Seedance 能"看到"@引用的参考图，不需要重复描述参考图中已有的静态内容（如人物长相、场景布局），重点描述"变化"：动作、运动、情绪转变、镜头运动
3. @引用语法：在开头声明素材引用并明确每个引用的用途
   - @图片N 作为首帧 / @图片N 的人物形象 / 场景参考 @图片N
4. 节拍密度约束：1拍 ≈ 2.5秒，不要在短时间内塞入过多动作
5. 头尾安全区：前0.5s给环境或主体一个静态建立，后0.5s让动作自然收住
${useTimeSections ? `6. 分时段描述（时长≥10秒推荐）：
   按时间段精确控制画面内容，如：
   0-3秒：[开场画面]
   4-8秒：[中段发展]
   9-${durationSec}秒：[收尾定格]` : '6. 使用连续段落描述即可（时长<10秒）'}
7. 音频设计：包含背景音乐风格、环境音效、动作音效
8. 禁忌：不用否定句、不重复参考图静态内容、不用抽象概念、@引用必须指定用途

【输出要求】
- 中文提示词
- 直接输出完整的 Seedance 1.5 Pro 提示词，可直接复制使用
- 不要有任何额外说明

请严格输出以下JSON格式：
{
  "prompt": "完整的 Seedance 1.5 Pro 提示词",
  "assetRefs": ["@图片1", "@图片3"],
  "durationSec": ${durationSec},
  "shotCount": 1
}`;

      const raw = await callGeminiPro(prompt);
      const cleaned = raw.replace(/^```json\s*/m, '').replace(/^```\s*/m, '').replace(/```\s*$/m, '').trim();
      return JSON.parse(cleaned);
    }),

  // 11. 精品剧 — 批量生成所有剧情点的 Seedance 提示词 ─────────────────────────
  premiumBatchSeedancePrompts: publicProcedure
    .input(z.object({
      plotPoints: z.array(z.object({
        id: z.string(),
        title: z.string(),
        characters: z.array(z.string()),
        scene: z.string(),
        shotGroup: z.string(),
        durationSuggestion: z.string(),
        directorNotes: z.string(),
      })),
      assetMapping: z.array(z.object({
        refId: z.string(),
        type: z.string(),
        name: z.string(),
      })),
      styleZh: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { plotPoints, assetMapping, styleZh } = input;

      const assetTable = assetMapping.map(a => `${a.refId} → ${a.type}：${a.name}`).join('\n');

      const plotPointsDesc = plotPoints.map(pp => {
        const durationMatch = pp.durationSuggestion.match(/(\d+)/);
        const dur = durationMatch ? parseInt(durationMatch[1]) : 8;
        return `### ${pp.id} ${pp.title}\n- 人物：${pp.characters.join('、')}\n- 场景：${pp.scene}\n- 镜头组：${pp.shotGroup}\n- 时长建议：${pp.durationSuggestion}（${dur}秒）\n- 导演阐述：${pp.directorNotes}`;
      }).join('\n\n');

      const prompt = `你是专业的 Seedance 1.5 Pro 分镜师。请根据导演讲戏本，为以下所有剧情点批量生成 Seedance 1.5 Pro 视频提示词。

【素材对应表】
${assetTable}

【所有剧情点】
${plotPointsDesc}

整体风格：${styleZh || '未指定'}

【Seedance 1.5 Pro 提示词方法论】
1. 叙事描述式：用完整段落描述，不要关键词堆叠
2. 参考图已见原则：不重复描述参考图中已有的静态内容，重点描述"变化"
3. @引用语法：开头声明素材引用并明确用途
4. 节拍密度约束：1拍 ≈ 2.5秒
5. 头尾安全区：前后0.5s不放关键内容
6. 时长≥10秒使用分时段描述，<10秒使用连续段落
7. 包含音频设计（背景音乐、环境音效、动作音效）
8. 禁忌：不用否定句、不重复静态内容、不用抽象概念、@引用必须指定用途

【输出格式】严格输出以下JSON：
{
  "prompts": [
    {
      "plotPointId": "P01",
      "prompt": "完整的 Seedance 1.5 Pro 提示词",
      "assetRefs": ["@图片1", "@图片3"],
      "durationSec": 8
    }
  ]
}`;

      const raw = await callGeminiPro(prompt, 65536);
      const cleaned = raw.replace(/^```json\s*/m, '').replace(/^```\s*/m, '').replace(/```\s*$/m, '').trim();
      return JSON.parse(cleaned);
    }),

  // 6. 验证 Gemini API Key --------------------------------------------
  testConnection: publicProcedure
    .mutation(async () => {
      const result = await callGemini(JSON.stringify({ test: true }) + '\n请回复：{"status":"ok"}');
      return { ok: true, raw: result };
    }),
});
