// DESIGN: "鎏光机" 导演手册工业风暗色系 — Single-Project Context (v3)
// Now backed by ProjectManagerContext for multi-project support + localStorage persistence.
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { useProjectManager } from "./ProjectManagerContext";

// ─── Core Types ───────────────────────────────────────────────────────────────

export interface ProjectInfo {
  title: string;
  type: string;
  episodes: string;
  platform: string;
  ratio: string;
  audience: string;
  selling: string;
  styleZh: string;
  styleEn: string;
  styleCategory: string;  // 大类 ID: "2D" | "3D" | "CG" | "live"
  styleSubtype: string;   // 小类 ID，可为空
  market: string;         // 目标市场："中国" | "美国" | "日本" | "印度" | "俄罗斯" 等
  orientation: string;    // 画幅方向："landscape" | "portrait"
}

export interface Episode {
  id: string;
  number: number;
  title: string;
  duration: number;
  synopsis: string;
  scenes: string[];
  props: string[];
  characters: string[];
}

export interface Character {
  id: string;
  name: string;
  role: string;          // 角色定位（主角/配角/反派等）
  appearance: string;    // 外貌特征
  costume: string;       // 服装/装甲描述
  marks: string;         // 特殊标记
  isMecha: boolean;      // 是否为机甲/载具类角色
  isQVersion?: boolean;   // 是否需要 Q 版形象（大头小身可爱风格）
  promptZh: string;      // MJ7 提示词（中文）
  promptEn: string;      // MJ7 提示词（英文）
  qVersionPromptZh?: string;  // Q版形象 MJ7 提示词（中文）
  qVersionPromptEn?: string;  // Q版形象 MJ7 提示词（英文）
  nanoPrompt?: string;        // Gemini 3 Pro Image 辅助提示词
  uploadedImageUrl?: string;  // 上传的 MJ 参考图 URL
  designImageUrl?: string;    // Gemini 生成的16:9角色设计主图
  mainImageUrl?: string;      // 居中兼容（就是 designImageUrl）
  closeupImageUrl?: string;   // 切分：近景
  frontImageUrl?: string;     // 切分：正视图
  sideImageUrl?: string;      // 切分：侧视图
  backImageUrl?: string;      // 切分：后视图
  assetLibId?: number;        // 已导入资产库的 ID
}

export interface EpisodeAsset {
  id: string;
  episodeId: string;
  type: "scene" | "prop";
  name: string;
  description: string;
  promptMJ: string;           // MJ7 提示词（JSON {zh,en}）
  nanoPrompt?: string;        // Gemini 3 Pro Image 辅助提示词
  uploadedImageUrl?: string;  // 上传的 MJ 参考图 URL
  mainImageUrl?: string;      // Gemini 生成的主视图 URL
  angle1ImageUrl?: string;    // 四分之三视角
  angle2ImageUrl?: string;    // 俯视
  angle3ImageUrl?: string;    // 仰视
  quadViewImageUrl?: string;  // 四宫格四方向参考图 URL（场景专用）
  assetLibId?: number;        // 已导入资产库的 ID
}

export interface Shot {
  id: string;
  episodeId: string;
  number: number;
  type: string;
  size: string;
  movement: string;
  description: string;
  vo: string;
  dialogue: string; // 对话台词
  sfx: string;
  duration: number;
  emotion: string;
  emotionLevel: number;
}

export interface VideoSegment {
  id: string;
  episodeId: string;
  name: string;
  shotIds: string[];
  duration: number;
  prompt: string;
}

export interface ScriptAnalysis {
  episodes: Episode[];
  globalCharacters: string[];
  isAnalyzed: boolean;
}

// ─── Context Type ─────────────────────────────────────────────────────────────

interface ProjectContextType {
  projectInfo: ProjectInfo;
  scriptText: string;
  scriptAnalysis: ScriptAnalysis;
  characters: Character[];
  episodeAssets: EpisodeAsset[];
  shots: Shot[];
  videoSegments: VideoSegment[];
  activePhase: string;
  activeEpisodeId: string;
  completedPhases: Set<string>;

  setActivePhase: (phase: string) => void;
  setActiveEpisodeId: (id: string) => void;
  updateProjectInfo: (info: Partial<ProjectInfo>) => void;

  setScriptText: (text: string) => void;
  analyzeScript: () => void;
  analyzeScriptWithAI: (result: {
    episodes: Array<{
      id: string; number: number; title: string; duration: number; synopsis: string;
      scenes: Array<{ name: string; environment: string; timeOfDay: string; atmosphere: string; visualFeatures: string }>;
      props: Array<{ name: string; appearance: string; material: string; purpose: string }>;
    }>;
    characters: Array<{
      name: string; role: string; isMecha: boolean; appearance: string;
      costume: string; marks: string; personality: string;
    }>;
  }) => void;
  updateEpisode: (id: string, data: Partial<Episode>) => void;

  addCharacter: (name?: string) => void;
  updateCharacter: (id: string, data: Partial<Character>) => void;
  removeCharacter: (id: string) => void;
  generateCharacterPrompt: (char: Character) => { zh: string; en: string };

  addEpisodeAsset: (episodeId: string, type: "scene" | "prop") => void;
  updateEpisodeAsset: (id: string, data: Partial<EpisodeAsset>) => void;
  removeEpisodeAsset: (id: string) => void;
  generateAssetPromptMJ: (asset: EpisodeAsset) => string;

  addShot: (episodeId: string) => void;
  updateShot: (id: string, data: Partial<Shot>) => void;
  removeShot: (id: string) => void;
  autoGenerateShots: (episodeId: string) => void;
  addShotsFromAI: (episodeId: string, shots: Omit<Shot, 'id' | 'episodeId'>[]) => void;

  addVideoSegment: (episodeId: string) => void;
  updateVideoSegment: (id: string, data: Partial<VideoSegment>) => void;
  removeVideoSegment: (id: string) => void;
  autoGenerateSegments: (episodeId: string) => void;
  generateSegmentPrompt: (segId: string) => string;

  markPhaseComplete: (phase: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const nanoid = () => Math.random().toString(36).slice(2, 9);

const SHOT_TEMPLATES_BY_TYPE: Record<string, Array<{
  type: string; size: string; movement: string; emotion: string; emotionLevel: number;
  descTemplate: string; sfxTemplate: string;
}>> = {
  "短剧": [
    { type: "定场镜头", size: "大远景", movement: "固定", emotion: "平静", emotionLevel: 1, descTemplate: "场景全貌，交代环境与时间", sfxTemplate: "环境背景音" },
    { type: "逻辑镜头", size: "全景", movement: "固定", emotion: "平静", emotionLevel: 1, descTemplate: "角色登场，交代人物关系", sfxTemplate: "脚步声，环境音" },
    { type: "Action镜头", size: "中景", movement: "推（Dolly In）", emotion: "紧张", emotionLevel: 3, descTemplate: "核心冲突爆发，角色做出关键行动", sfxTemplate: "戏剧性音效" },
    { type: "Reaction镜头", size: "近景", movement: "固定", emotion: "紧张", emotionLevel: 3, descTemplate: "对方角色的震惊反应", sfxTemplate: "静默或心跳声" },
    { type: "Action镜头", size: "中近景", movement: "固定", emotion: "热血、燃", emotionLevel: 4, descTemplate: "主角反击或做出决定", sfxTemplate: "动作音效" },
    { type: "Reaction镜头", size: "特写", movement: "推（Dolly In）", emotion: "热血、燃", emotionLevel: 5, descTemplate: "主角眼神特写，坚定决心", sfxTemplate: "情绪音效" },
  ],
  "动画": [
    { type: "定场镜头", size: "大远景", movement: "航拍（Aerial）", emotion: "史诗、磅礴", emotionLevel: 3, descTemplate: "宏大的动画世界全景，确立世界观", sfxTemplate: "史诗背景音乐起" },
    { type: "逻辑镜头", size: "远景", movement: "降（Crane Down）", emotion: "神秘、悬疑", emotionLevel: 2, descTemplate: "镜头下降聚焦到主角所在地点", sfxTemplate: "风声，环境音" },
    { type: "Action镜头", size: "全景", movement: "跟（Follow）", emotion: "热血、燃", emotionLevel: 3, descTemplate: "主角行动，展示角色能力", sfxTemplate: "动作音效，能量音效" },
    { type: "Reaction镜头", size: "中近景", movement: "固定", emotion: "神圣、觉醒", emotionLevel: 4, descTemplate: "关键人物的震惊与敬畏", sfxTemplate: "静默" },
    { type: "Action镜头", size: "中景", movement: "环绕（Orbit）", emotion: "神圣、觉醒", emotionLevel: 5, descTemplate: "主角技能爆发或变身，能量特效", sfxTemplate: "爆发音效，能量冲击波" },
    { type: "旁跳镜头", size: "特写", movement: "固定", emotion: "史诗、磅礴", emotionLevel: 4, descTemplate: "关键道具或标志性元素特写", sfxTemplate: "余韵音效" },
  ],
  "广告": [
    { type: "定场镜头", size: "全景", movement: "推（Dolly In）", emotion: "温暖、亲密", emotionLevel: 2, descTemplate: "品牌场景建立，产品所在环境", sfxTemplate: "轻快背景音乐" },
    { type: "Action镜头", size: "中景", movement: "固定", emotion: "温暖、亲密", emotionLevel: 3, descTemplate: "用户使用产品的自然场景", sfxTemplate: "产品使用音效" },
    { type: "旁跳镜头", size: "大特写", movement: "推（Dolly In）", emotion: "神圣、觉醒", emotionLevel: 4, descTemplate: "产品核心卖点特写展示", sfxTemplate: "清脆提示音" },
    { type: "Reaction镜头", size: "近景", movement: "固定", emotion: "温暖、亲密", emotionLevel: 5, descTemplate: "用户满意的表情与反应", sfxTemplate: "愉悦音效" },
  ],
  "default": [
    { type: "定场镜头", size: "大远景", movement: "固定", emotion: "平静", emotionLevel: 1, descTemplate: "场景全貌，交代时间地点", sfxTemplate: "环境背景音" },
    { type: "逻辑镜头", size: "全景", movement: "固定", emotion: "平静", emotionLevel: 2, descTemplate: "人物登场，交代关系", sfxTemplate: "脚步声" },
    { type: "Action镜头", size: "中景", movement: "推（Dolly In）", emotion: "紧张", emotionLevel: 3, descTemplate: "核心事件发生", sfxTemplate: "戏剧音效" },
    { type: "Reaction镜头", size: "近景", movement: "固定", emotion: "紧张", emotionLevel: 3, descTemplate: "角色反应", sfxTemplate: "静默" },
    { type: "Action镜头", size: "中近景", movement: "固定", emotion: "热血、燃", emotionLevel: 4, descTemplate: "高潮动作", sfxTemplate: "动作音效" },
    { type: "旁跳镜头", size: "特写", movement: "固定", emotion: "史诗、磅礴", emotionLevel: 5, descTemplate: "关键细节特写", sfxTemplate: "余韵" },
  ],
};

// ─── 人物识别黑名单（非角色词汇）─────────────────────────────────────────────
const CHAR_BLACKLIST = new Set([
  "旁白", "解说", "画外音", "字幕", "备注", "注释", "说明", "介绍", "简介",
  "出场人物", "登场人物", "人物介绍", "角色介绍", "人物列表", "角色列表",
  "一卡", "二卡", "三卡", "片头", "片尾", "开场", "结尾", "序章", "尾声",
  "第一幕", "第二幕", "第三幕", "场景", "地点", "时间", "背景", "环境",
  "导演", "编剧", "制作", "出品", "监制", "策划", "总监",
  "内容", "故事", "剧情", "情节", "主题", "风格", "类型",
]);

// 机甲/载具关键词
const MECHA_KEYWORDS = ["机甲", "战甲", "装甲", "机器人", "战机", "载具", "战舰", "飞船", "坦克", "战车", "机械"];

// 清理人物名：去掉括号内的情绪/状态后缀，如「张三（快乐）」→「张三」
function cleanCharName(raw: string): string {
  return raw.replace(/[（(][^）)]*[）)]/g, "").replace(/[「」【】]/g, "").trim();
}

// 判断是否为有效人物名
function isValidCharName(name: string): boolean {
  const cleaned = cleanCharName(name);
  if (!cleaned || cleaned.length < 2 || cleaned.length > 10) return false;
  if (CHAR_BLACKLIST.has(cleaned)) return false;
  // 过滤纯数字、纯标点、包含特殊符号的
  if (/^[\d\s\-—–·•·]+$/.test(cleaned)) return false;
  if (/[\d]{2,}/.test(cleaned)) return false; // 含两位以上数字（如EP01）
  return true;
}

function isMechaChar(name: string, context: string): boolean {
  return MECHA_KEYWORDS.some(kw => name.includes(kw) || context.includes(kw + name) || context.includes(name + kw));
}

function parseScript(text: string, projectType: string): ScriptAnalysis {
  if (!text.trim()) return { episodes: [], globalCharacters: [], isAnalyzed: false };
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const episodes: Episode[] = [];
  const allChars = new Map<string, string>(); // cleanedName → originalName
  // EP-01 / 第一集 / Episode 1 等标记
  const epRegex = /^(第\s*[一二三四五六七八九十百\d]+\s*集|EP[\s\-_]?\d+|Episode\s*\d+|第\s*\d+\s*集)/i;
  // 前置介绍段落标记（序章、人物介绍、背景介绍等）
  const introRegex = /^(序章|前言|简介|介绍|背景|说明|人物|角色|出场|登场|EP[\s\-_]?0*1\b|Episode\s*0*1\b|第\s*[零〇0]\s*集)/i;
  const charRegex = /【([^】]{1,12})】|「([^」]{1,12})」|^([^\s：:，,。.！!？?（(【「]{1,10})[：:]/;
  let currentEpLines: string[] = [];
  let currentEpTitle = "";
  let epNum = 0;
  let isIntroSection = false;

  const extractCharsFromLines = (epLines: string[], content: string): string[] => {
    const chars: string[] = [];
    epLines.forEach(line => {
      const m = line.match(charRegex);
      if (m) {
        const raw = m[1] || m[2] || m[3];
        if (raw && isValidCharName(raw)) {
          const cleaned = cleanCharName(raw);
          if (!allChars.has(cleaned)) allChars.set(cleaned, cleaned);
          chars.push(cleaned);
        }
      }
    });
    return Array.from(new Set(chars));
  };

  const extractScenesFromContent = (content: string): string[] => {
    // 提取场景：优先匹配「场景名+环境」组合
    const scenePatterns = [
      /(?:在|于|来到|抵达|进入)([^，。！？\n]{2,12}(?:室|殿|场|地|区|城|村|山|海|林|街|楼|院|谷|洞|港|站|基地|遗迹|战场|空间))/g,
      /\[([^\]]{2,15})\]/g, // [场景名] 格式
      /（([^）]{2,15}(?:室|殿|场|地|区|城|村|山|海|林|街|楼|院|谷|洞|港|站|基地|遗迹|战场))）/g,
    ];
    const scenes = new Set<string>();
    scenePatterns.forEach(pattern => {
      let m;
      while ((m = pattern.exec(content)) !== null) {
        if (m[1] && m[1].length >= 2) scenes.add(m[1].trim());
      }
    });
    // 备用：关键词匹配
    if (scenes.size < 2) {
      const fallback = ["指挥室", "战场", "基地", "实验室", "宫殿", "城市", "废墟", "森林", "海底", "太空", "地下", "天空", "街道", "山顶", "海边"];
      fallback.forEach(w => { if (content.includes(w) && scenes.size < 5) scenes.add(w); });
    }
    return Array.from(scenes).slice(0, 5);
  };

  const extractPropsFromContent = (content: string): string[] => {
    const propPatterns = [
      /(?:拿起|握住|取出|使用|启动|激活|持有)([^，。！？\n]{1,8}(?:剑|枪|刀|盾|杖|弓|斧|锤|符|阵|石|晶|核|器|甲|盔|炮|弹|炸弹|装置|设备|芯片|数据|文件|地图|钥匙|戒指|项链|面具|徽章|旗帜))/g,
    ];
    const props = new Set<string>();
    propPatterns.forEach(pattern => {
      let m;
      while ((m = pattern.exec(content)) !== null) {
        if (m[1] && m[1].length >= 1) props.add(m[1].trim());
      }
    });
    // 备用关键词
    if (props.size < 2) {
      const fallback = ["符文", "魔法阵", "钥匙", "地图", "面具", "徽章", "核心", "芯片", "武器", "装置"];
      fallback.forEach(w => { if (content.includes(w) && props.size < 4) props.add(w); });
    }
    return Array.from(props).slice(0, 4);
  };

  const flushEpisode = (forceSkip = false) => {
    if (!currentEpLines.length && !currentEpTitle) return;
    if (forceSkip || isIntroSection) {
      // 仍然收集全局人物，但不生成集数
      extractCharsFromLines(currentEpLines, currentEpLines.join(" "));
      currentEpLines = [];
      currentEpTitle = "";
      isIntroSection = false;
      return;
    }
    epNum++;
    const content = currentEpLines.join(" ");
    const chars = extractCharsFromLines(currentEpLines, content);
    const scenes = extractScenesFromContent(content);
    const props = extractPropsFromContent(content);
    const duration = Math.max(1, Math.min(8, Math.round(content.length / 120)));
    episodes.push({
      id: nanoid(), number: epNum, title: currentEpTitle || `第${epNum}集`,
      duration, synopsis: content.slice(0, 300) + (content.length > 300 ? "..." : ""),
      scenes: scenes.length ? scenes : ["主要场景"],
      props: props.length ? props : [],
      characters: chars,
    });
    currentEpLines = [];
    currentEpTitle = "";
  };

  const hasEpMarkers = lines.some(l => epRegex.test(l));
  if (!hasEpMarkers) {
    // 无分集标记，整体作为一集
    const content = text;
    const chars = extractCharsFromLines(lines, content);
    const scenes = extractScenesFromContent(content);
    const props = extractPropsFromContent(content);
    const duration = Math.max(1, Math.min(8, Math.round(text.length / 120)));
    episodes.push({
      id: nanoid(), number: 1, title: "第1集",
      duration, synopsis: text.slice(0, 300) + (text.length > 300 ? "..." : ""),
      scenes: scenes.length ? scenes : ["主要场景"],
      props: props.length ? props : [],
      characters: chars,
    });
  } else {
    for (const line of lines) {
      if (epRegex.test(line)) {
        // 判断是否为序章/介绍段（EP-01 或含介绍关键词）
        const isIntro = introRegex.test(line);
        flushEpisode(isIntro);
        currentEpTitle = line;
        isIntroSection = isIntro;
      } else {
        currentEpLines.push(line);
        // 实时收集全局人物
        const m = line.match(charRegex);
        if (m) {
          const raw = m[1] || m[2] || m[3];
          if (raw && isValidCharName(raw)) {
            const cleaned = cleanCharName(raw);
            allChars.set(cleaned, cleaned);
          }
        }
      }
    }
    flushEpisode();
  }
  return {
    episodes,
    globalCharacters: Array.from(allChars.keys()),
    isAnalyzed: true,
  };
}

function autoGenerateShotsForEpisode(episode: Episode, projectType: string): Shot[] {
  const templates = SHOT_TEMPLATES_BY_TYPE[projectType] || SHOT_TEMPLATES_BY_TYPE["default"];
  const targetShots = Math.round(episode.duration * 25);
  const shots: Shot[] = [];
  const cycles = Math.ceil(targetShots / templates.length);
  let shotNum = 0;
  for (let c = 0; c < cycles && shots.length < targetShots; c++) {
    for (const tpl of templates) {
      if (shots.length >= targetShots) break;
      shotNum++;
      const dur = tpl.emotionLevel >= 4 ? 2 + Math.floor(Math.random() * 2) : 3 + Math.floor(Math.random() * 2);
      const sceneHint = episode.scenes[shotNum % episode.scenes.length] || "主要场景";
      const charHint = episode.characters[shotNum % Math.max(1, episode.characters.length)] || "主角";
      shots.push({
        id: nanoid(), episodeId: episode.id, number: shotNum,
        type: tpl.type, size: tpl.size, movement: tpl.movement,
        description: `${sceneHint}，${charHint}，${tpl.descTemplate}`,
        vo: shotNum % 5 === 0 ? `[第${episode.number}集旁白${Math.ceil(shotNum / 5)}]` : "",
        dialogue: "",
        sfx: tpl.sfxTemplate, duration: dur,
        emotion: tpl.emotion, emotionLevel: tpl.emotionLevel,
      });
    }
  }
  return shots;
}

function autoGenerateSegmentsFromShots(shots: Shot[], episodeId: string): VideoSegment[] {
  const segments: VideoSegment[] = [];
  let i = 0, segNum = 1;
  while (i < shots.length) {
    const groupShots: Shot[] = [];
    let totalDur = 0;
    while (i < shots.length && groupShots.length < 5 && totalDur + shots[i].duration <= 15) {
      groupShots.push(shots[i]); totalDur += shots[i].duration; i++;
    }
    if (groupShots.length === 0) { i++; continue; }
    segments.push({
      id: nanoid(), episodeId,
      name: `片段${segNum}（镜头${groupShots[0].number}-${groupShots[groupShots.length - 1].number}）`,
      shotIds: groupShots.map(s => s.id), duration: totalDur, prompt: "",
    });
    segNum++;
  }
  return segments;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ProjectContext = createContext<ProjectContextType | null>(null);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const manager = useProjectManager();
  const activeSnap = manager.projects.find(p => p.id === manager.activeProjectId);

  // Local state mirrors the active snapshot; syncs to manager on every change
  const [projectInfo, setProjectInfo] = useState<ProjectInfo>(
    activeSnap?.projectInfo ?? { title: "", type: "", episodes: "", platform: "", ratio: "9:16 竖屏", audience: "", selling: "", styleZh: "", styleEn: "", styleCategory: "", styleSubtype: "", market: "中国", orientation: "portrait" }
  );
  const [scriptText, setScriptTextState] = useState(activeSnap?.scriptText ?? "");
  const [scriptAnalysis, setScriptAnalysis] = useState<ScriptAnalysis>(
    activeSnap?.scriptAnalysis ?? { episodes: [], globalCharacters: [], isAnalyzed: false }
  );
  const [characters, setCharacters] = useState<Character[]>(activeSnap?.characters ?? []);
  const [episodeAssets, setEpisodeAssets] = useState<EpisodeAsset[]>(activeSnap?.episodeAssets ?? []);
  const [shots, setShots] = useState<Shot[]>(activeSnap?.shots ?? []);
  const [videoSegments, setVideoSegments] = useState<VideoSegment[]>(activeSnap?.videoSegments ?? []);
  const [activePhase, setActivePhaseState] = useState(activeSnap?.activePhase ?? "phase1");
  const [activeEpisodeId, setActiveEpisodeId] = useState("");
  const [completedPhases, setCompletedPhases] = useState<Set<string>>(
    () => new Set<string>(activeSnap?.completedPhases ?? [])
  );
  // Guard: only allow syncToManager AFTER we've loaded data from the manager at least once.
  // This prevents the initial empty state from overwriting localStorage data.
  const isInitializedRef = useRef(false);

  // When active project changes in manager, reload all local state
  useEffect(() => {
    const snap = manager.projects.find(p => p.id === manager.activeProjectId);
    if (!snap) return;
    setProjectInfo(snap.projectInfo);
    setScriptTextState(snap.scriptText);
    setScriptAnalysis(snap.scriptAnalysis);
    setCharacters(snap.characters);
    setEpisodeAssets(snap.episodeAssets);
    setShots(snap.shots);
    setVideoSegments(snap.videoSegments);
    setActivePhaseState(snap.activePhase);
    setCompletedPhases(new Set<string>(snap.completedPhases));
    if (snap.scriptAnalysis.episodes.length > 0) {
      setActiveEpisodeId(snap.scriptAnalysis.episodes[0].id);
    }
    // Mark as initialized so syncToManager can now write back
    isInitializedRef.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manager.activeProjectId]);

  // On first mount, if activeSnap already exists (localStorage loaded synchronously),
  // mark as initialized immediately so user edits are not lost.
  useEffect(() => {
    if (activeSnap && !isInitializedRef.current) {
      isInitializedRef.current = true;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync all state changes back to manager — only after initialization
  useEffect(() => {
    if (!isInitializedRef.current) return;
    manager.updateProjectSnapshot({
      projectInfo, scriptText, scriptAnalysis, characters,
      episodeAssets, shots, videoSegments,
      activePhase, completedPhases: Array.from(completedPhases),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectInfo, scriptText, scriptAnalysis, characters, episodeAssets, shots, videoSegments, activePhase, completedPhases]);

  const setActivePhase = useCallback((phase: string) => setActivePhaseState(phase), []);

  const updateProjectInfo = useCallback((info: Partial<ProjectInfo>) => {
    setProjectInfo(prev => ({ ...prev, ...info }));
  }, []);

  const setScriptText = useCallback((text: string) => setScriptTextState(text), []);

  const analyzeScript = useCallback(() => {
    const analysis = parseScript(scriptText, projectInfo.type);
    setScriptAnalysis(analysis);
    if (analysis.episodes.length > 0) setActiveEpisodeId(analysis.episodes[0].id);
    if (analysis.globalCharacters.length > 0) {
      const fullText = scriptText;
      setCharacters(analysis.globalCharacters.map(name => ({
        id: nanoid(), name, role: "", appearance: "", costume: "", marks: "",
        isMecha: isMechaChar(name, fullText),
        promptZh: "", promptEn: "",
      })));
    }
    const newAssets: EpisodeAsset[] = [];
    analysis.episodes.forEach(ep => {
      ep.scenes.forEach(scene => newAssets.push({ id: nanoid(), episodeId: ep.id, type: "scene", name: scene, description: `第${ep.number}集主要场景`, promptMJ: "" }));
      ep.props.forEach(prop => newAssets.push({ id: nanoid(), episodeId: ep.id, type: "prop", name: prop, description: `第${ep.number}集关键道具`, promptMJ: "" }));
    });
    setEpisodeAssets(newAssets);
  }, [scriptText, projectInfo.type]);

  // AI-powered script analysis: accepts structured result from Gemini
  const analyzeScriptWithAI = useCallback((result: {
    episodes: Array<{
      id: string; number: number; title: string; duration: number; synopsis: string;
      scenes: Array<{ name: string; environment: string; timeOfDay: string; atmosphere: string; visualFeatures: string }>;
      props: Array<{ name: string; appearance: string; material: string; purpose: string }>;
    }>;
    characters: Array<{
      name: string; role: string; isMecha: boolean; appearance: string;
      costume: string; marks: string; personality: string;
    }>;
  }) => {
    // Convert AI result to Episode format
    const episodes: Episode[] = result.episodes.map(ep => ({
      id: nanoid(),
      number: ep.number,
      title: ep.title,
      duration: ep.duration,
      synopsis: ep.synopsis,
      scenes: ep.scenes.map(s => s.name),
      props: ep.props.map(p => p.name),
      characters: [],
    }));

    const analysis: ScriptAnalysis = {
      episodes,
      globalCharacters: result.characters.map(c => c.name),
      isAnalyzed: true,
    };
    setScriptAnalysis(analysis);
    if (episodes.length > 0) setActiveEpisodeId(episodes[0].id);

    // Set characters with AI-extracted details
    setCharacters(result.characters.map(c => ({
      id: nanoid(),
      name: c.name,
      role: c.role,
      appearance: c.appearance,
      costume: c.costume,
      marks: c.marks,
      isMecha: c.isMecha,
      promptZh: "",
      promptEn: "",
    })));

    // Set episode assets with rich AI descriptions
    const newAssets: EpisodeAsset[] = [];
    result.episodes.forEach((aiEp, idx) => {
      const ep = episodes[idx];
      if (!ep) return;
      aiEp.scenes.forEach(scene => newAssets.push({
        id: nanoid(), episodeId: ep.id, type: "scene",
        name: scene.name,
        description: `${scene.environment}，${scene.timeOfDay}，${scene.atmosphere}，${scene.visualFeatures}`,
        promptMJ: "",
      }));
      aiEp.props.forEach(prop => newAssets.push({
        id: nanoid(), episodeId: ep.id, type: "prop",
        name: prop.name,
        description: `${prop.appearance}，材质：${prop.material}，用途：${prop.purpose}`,
        promptMJ: "",
      }));
    });
    setEpisodeAssets(newAssets);
  }, []);

  const updateEpisode = useCallback((id: string, data: Partial<Episode>) => {
    setScriptAnalysis(prev => ({ ...prev, episodes: prev.episodes.map(e => e.id === id ? { ...e, ...data } : e) }));
  }, []);

  const addCharacter = useCallback((name = "") => {
    setCharacters(prev => [...prev, { id: nanoid(), name, role: "", appearance: "", costume: "", marks: "", isMecha: false, promptZh: "", promptEn: "" }]);
  }, []);

  const updateCharacter = useCallback((id: string, data: Partial<Character>) => {
    setCharacters(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
  }, []);

  const removeCharacter = useCallback((id: string) => {
    setCharacters(prev => prev.filter(c => c.id !== id));
  }, []);

  const generateCharacterPrompt = useCallback((char: Character) => {
    const isMecha = char.isMecha;
    // ── MJ7 人物/机甲提示词 ──
    const charDesc = char.appearance ? char.appearance : (isMecha ? "精密机械结构，金属装甲表面" : "五官立体，气质独特");
    const costumeDesc = char.costume ? char.costume : (isMecha ? "全身战甲，关节处有发光能量线" : "特色服装，细节丰富");
    const bodyDesc = char.role ? char.role : (isMecha ? "高大威猛的机甲体型，比例夸张" : "标准人体比例，站姿自然");
    const marksDesc = char.marks ? `，${char.marks}` : "";
    const styleTag = projectInfo.styleZh || "";

    let zh: string;
    if (isMecha) {
      zh = `机甲设计参考图，纯黑色背景，蓝图风格辅助线，画幅分为左右两部分。
左侧：${char.name || "机甲"}的正面特写，${charDesc}，${costumeDesc}，发光能量核心，金属质感高光，科技感强烈。
右侧：同一机甲的标准三视图（正面、侧面、背面），全身站姿，正交视图，清晰展示${bodyDesc}，装甲分层结构，武器系统${marksDesc}。
整体要求：两部分机甲设计、比例、细节完全一致，无驾驶员，纯机甲参考。
${styleTag}`;
    } else {
      zh = `角色设计参考图，干净的深灰色背景，画幅分为左右两部分。
左侧：${char.name || "角色"}的电影级特写肖像，${charDesc}，${char.role ? char.role + "气质" : "专注坚定的表情"}，电影级侧光照明，面部细节清晰。
右侧：同一角色的标准三视图（正面、侧面、背面），全身站姿，正交视图，清晰展示${costumeDesc}，${bodyDesc}${marksDesc}。
整体要求：左右两部分角色设计、比例、细节完全一致。
${styleTag}`;
    }

    let en: string;
    const charDescEn = char.appearance || (isMecha ? "precision mechanical structure, metallic armor surface" : "defined facial features, distinctive temperament");
    const costumeDescEn = char.costume || (isMecha ? "full-body battle armor, glowing energy lines at joints" : "distinctive costume with rich details");
    const bodyDescEn = char.role || (isMecha ? "imposing mecha frame, exaggerated proportions" : "natural standing pose, standard proportions");
    const marksDescEn = char.marks ? `, ${char.marks}` : "";
    const styleTagEn = projectInfo.styleEn || "";

    if (isMecha) {
      en = `Mecha design reference sheet, pure black background with blueprint guide lines, frame split into two parts.
Left side: Close-up front view of ${char.name || "the mecha"}, ${charDescEn}, ${costumeDescEn}, glowing energy core, metallic highlights, strong sci-fi aesthetic.
Right side: Standard orthographic three-view turnaround (front, side, back) of the same mecha in standing pose. Clearly showing ${bodyDescEn}, layered armor structure, weapon systems${marksDescEn}.
Overall: Both parts must be perfectly consistent in design, proportions, and details. No pilot, pure mecha reference.
${styleTagEn}`;
    } else {
      en = `Character design sheet, clean dark gray background, frame split into two parts.
Left side: Cinematic close-up portrait of ${char.name || "the character"}, ${charDescEn}, ${char.role ? char.role + " temperament" : "focused and determined expression"}, cinematic side lighting, clear facial details.
Right side: Standard orthographic three-view turnaround (front, side, back) in full-body standing pose. Clearly showing ${costumeDescEn}, ${bodyDescEn}${marksDescEn}.
Overall: Character design, proportions, and details must be perfectly consistent between both parts.
${styleTagEn}`;
    }
    return { zh, en };
  }, [projectInfo.styleZh, projectInfo.styleEn]);

  const addEpisodeAsset = useCallback((episodeId: string, type: "scene" | "prop") => {
    setEpisodeAssets(prev => [...prev, { id: nanoid(), episodeId, type, name: "", description: "", promptMJ: "" }]);
  }, []);

  const updateEpisodeAsset = useCallback((id: string, data: Partial<EpisodeAsset>) => {
    setEpisodeAssets(prev => prev.map(a => a.id === id ? { ...a, ...data } : a));
  }, []);

  const removeEpisodeAsset = useCallback((id: string) => {
    setEpisodeAssets(prev => prev.filter(a => a.id !== id));
  }, []);

  const generateAssetPromptMJ = useCallback((asset: EpisodeAsset) => {
    const style = projectInfo.styleZh || "";
    const desc = asset.description || "";
    const name = asset.name || "未命名";
    if (asset.type === "scene") {
      // 场景：基于描述内容分析，生成富描述 MJ7 提示词
      const timeHint = desc.includes("夜") || desc.includes("黑暗") ? "深夜，月光或人造光源" :
                       desc.includes("黄昏") || desc.includes("傍晚") ? "黄昏时分，橙红色天空" :
                       desc.includes("清晨") || desc.includes("日出") ? "清晨，柔和晨光" : "自然光线，时间感明确";
      const atmoHint = desc.includes("废墟") || desc.includes("破败") ? "废墟感，历史沧桑，植被侵蚀" :
                       desc.includes("科技") || desc.includes("未来") ? "高科技环境，全息投影，金属质感" :
                       desc.includes("战场") || desc.includes("战争") ? "战场废墟，硝烟弥漫，紧张氛围" :
                       desc.includes("宫殿") || desc.includes("皇宫") ? "宏伟宫殿建筑，金碧辉煌，权力感" : "细节丰富，氛围感强烈";
      return `${name}场景设计图，${desc || atmoHint}，${timeHint}，${atmoHint}，电影级宽画幅构图，精细环境细节，无人物，纯场景参考，远中近景层次分明，景深效果。${style} --ar 16:9`;
    }
    // 道具/机甲武器：基于描述生成富描述提示词
    const materialHint = desc.includes("金属") || desc.includes("钢") ? "金属质感，高光反射，工业感" :
                         desc.includes("魔法") || desc.includes("符文") ? "魔法符文发光，神秘能量流动" :
                         desc.includes("古老") || desc.includes("古代") ? "古老工艺，岁月痕迹，历史感" :
                         desc.includes("科技") || desc.includes("能量") ? "科技感，能量核心发光，精密结构" : "精致工艺，细节丰富";
    return `${name}道具设计图，${desc || materialHint}，${materialHint}，深灰色纯净背景，多角度展示（正面、侧面、细节特写），高精度材质渲染，产品级展示光效。${style} --ar 1:1`;
  }, [projectInfo.styleZh]);

  const addShot = useCallback((episodeId: string) => {
    setShots(prev => {
      const epShots = prev.filter(s => s.episodeId === episodeId);
      return [...prev, { id: nanoid(), episodeId, number: epShots.length + 1, type: "定场镜头", size: "全景", movement: "固定", description: "", vo: "", dialogue: "", sfx: "", duration: 3, emotion: "平静", emotionLevel: 2 }];
    });
  }, []);

  const updateShot = useCallback((id: string, data: Partial<Shot>) => {
    setShots(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
  }, []);

  const removeShot = useCallback((id: string) => {
    setShots(prev => prev.filter(s => s.id !== id));
  }, []);

  const addShotsFromAI = useCallback((episodeId: string, newShots: Omit<Shot, 'id' | 'episodeId'>[]) => {
    setShots(prev => {
      const others = prev.filter(s => s.episodeId !== episodeId);
      const mapped = newShots.map(s => ({ ...s, id: nanoid(), episodeId }));
      return [...others, ...mapped];
    });
  }, []);

  const autoGenerateShots = useCallback((episodeId: string) => {
    const episode = scriptAnalysis.episodes.find(e => e.id === episodeId);
    if (!episode) return;
    setShots(prev => {
      const others = prev.filter(s => s.episodeId !== episodeId);
      return [...others, ...autoGenerateShotsForEpisode(episode, projectInfo.type)];
    });
    setVideoSegments(prev => prev.filter(s => s.episodeId !== episodeId));
  }, [scriptAnalysis.episodes, projectInfo.type]);

  const addVideoSegment = useCallback((episodeId: string) => {
    setVideoSegments(prev => {
      const epSegs = prev.filter(s => s.episodeId === episodeId);
      return [...prev, { id: nanoid(), episodeId, name: `片段${epSegs.length + 1}`, shotIds: [], duration: 12, prompt: "" }];
    });
  }, []);

  const updateVideoSegment = useCallback((id: string, data: Partial<VideoSegment>) => {
    setVideoSegments(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
  }, []);

  const removeVideoSegment = useCallback((id: string) => {
    setVideoSegments(prev => prev.filter(s => s.id !== id));
  }, []);

  const autoGenerateSegments = useCallback((episodeId: string) => {
    const epShots = shots.filter(s => s.episodeId === episodeId);
    if (epShots.length === 0) return;
    setVideoSegments(prev => [...prev.filter(s => s.episodeId !== episodeId), ...autoGenerateSegmentsFromShots(epShots, episodeId)]);
  }, [shots]);

  const generateSegmentPrompt = useCallback((segId: string) => {
    const seg = videoSegments.find(s => s.id === segId);
    if (!seg) return "";
    const relatedShots = seg.shotIds.map(id => shots.find(s => s.id === id)).filter(Boolean) as Shot[];
    let prompt = `一个${seg.duration}秒的视频片段，包含${relatedShots.length || 3}个镜头：\n`;
    if (relatedShots.length > 0) {
      relatedShots.forEach((shot, i) => {
        prompt += `镜头${i + 1}：${shot.size}，${shot.description || "[画面描述]"}。${shot.movement !== "固定" ? `镜头${shot.movement}。` : ""}\n`;
      });
      const vos = relatedShots.filter(s => s.vo).map(s => s.vo);
      if (vos.length) prompt += `VO: "${vos.join(" ")}"\n`;
      const sfxList = relatedShots.filter(s => s.sfx).map(s => s.sfx);
      if (sfxList.length) prompt += `SFX: ${sfxList.join("，")}\n`;
      const emotions = Array.from(new Set(relatedShots.filter(s => s.emotion).map(s => s.emotion)));
      if (emotions.length) prompt += `整体氛围：${emotions.join("、")}。\n`;
    } else {
      prompt += `镜头1：[景别]，[画面描述]。\n镜头2：[景别]，[画面描述]。\n镜头3：[景别]，[画面描述]。\nVO: "[旁白内容]"\nSFX: [音效描述]\n整体氛围：[情绪关键词]。\n`;
    }
    prompt += projectInfo.styleZh || "[视觉风格标签]";
    return prompt;
  }, [videoSegments, shots, projectInfo.styleZh]);

  const markPhaseComplete = useCallback((phase: string) => {
    setCompletedPhases(prev => {
      const next = new Set<string>(Array.from(prev));
      next.add(phase);
      return next;
    });
  }, []);

  return (
    <ProjectContext.Provider value={{
      projectInfo, scriptText, scriptAnalysis,
      characters, episodeAssets, shots, videoSegments,
      activePhase, activeEpisodeId, completedPhases,
      setActivePhase, setActiveEpisodeId, updateProjectInfo,
      setScriptText, analyzeScript, analyzeScriptWithAI, updateEpisode,
      addCharacter, updateCharacter, removeCharacter, generateCharacterPrompt,
      addEpisodeAsset, updateEpisodeAsset, removeEpisodeAsset, generateAssetPromptMJ,
      addShot, updateShot, removeShot, autoGenerateShots, addShotsFromAI,
      addVideoSegment, updateVideoSegment, removeVideoSegment, autoGenerateSegments, generateSegmentPrompt,
      markPhaseComplete,
    }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be used within ProjectProvider");
  return ctx;
}
