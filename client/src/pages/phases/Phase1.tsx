// Phase1: 项目定义 — 剧本上传 → 项目信息 → 市场/画幅/大风格 → AI 解析
import { useProject } from "@/contexts/ProjectContext";
import { STYLE_CATEGORIES } from "@/lib/workflowData";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2, ChevronRight, AlertTriangle, Upload, FileText,
  Wand2, Users, MapPin, Package, Plus, X, Globe, Monitor, Smartphone
} from "lucide-react";
import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import { extractTextFromFile, detectFormat, ACCEPTED_FORMATS, formatLabel } from "@/lib/scriptParser";
import { trpc } from "@/lib/trpc";
import { AIEstimateHint } from "@/components/AIEstimateHint";
import { GEMINI_ESTIMATE_SECS } from "@shared/const";

// ─── 市场配置 ─────────────────────────────────────────────────────────────────
const MARKETS = [
  { id: "中国",   label: "中国",   flag: "🇨🇳", voLang: "普通话",  voLangEn: "Mandarin Chinese" },
  { id: "美国",   label: "美国",   flag: "🇺🇸", voLang: "英语",    voLangEn: "English" },
  { id: "日本",   label: "日本",   flag: "🇯🇵", voLang: "日语",    voLangEn: "Japanese" },
  { id: "印度",   label: "印度",   flag: "🇮🇳", voLang: "印地语",  voLangEn: "Hindi" },
  { id: "俄罗斯", label: "俄罗斯", flag: "🇷🇺", voLang: "俄语",    voLangEn: "Russian" },
  { id: "韩国",   label: "韩国",   flag: "🇰🇷", voLang: "韩语",    voLangEn: "Korean" },
  { id: "法国",   label: "法国",   flag: "🇫🇷", voLang: "法语",    voLangEn: "French" },
  { id: "德国",   label: "德国",   flag: "🇩🇪", voLang: "德语",    voLangEn: "German" },
  { id: "西班牙", label: "西班牙", flag: "🇪🇸", voLang: "西班牙语", voLangEn: "Spanish" },
  { id: "阿拉伯", label: "阿拉伯", flag: "🇸🇦", voLang: "阿拉伯语", voLangEn: "Arabic" },
];

// ─── 大风格固定提示词 ──────────────────────────────────────────────────────────
export const STYLE_FIXED_PROMPTS: Record<string, { zh: string; en: string; desc: string }> = {
  "2D": {
    desc: "平面手绘动画",
    zh: "2D动画风格，手绘线条，平涂上色，动画质感，4K超清",
    en: "2D animation style, hand-drawn linework, flat color fills, animated aesthetic, 4K ultra HD",
  },
  "3D": {
    desc: "三维建模渲染",
    zh: "3D三维动画风格，精细建模，PBR材质渲染，电影级灯光，4K超清",
    en: "3D animation style, detailed modeling, PBR material rendering, cinematic lighting, 4K ultra HD",
  },
  "CG": {
    desc: "超写实计算机图形",
    zh: "超写实CG风格，照片级真实感，次表面散射皮肤，电影级渲染，4K超清",
    en: "Photorealistic CG style, photorealistic quality, subsurface scattering skin, cinematic rendering, 4K ultra HD",
  },
  "live": {
    desc: "真人电影摄影",
    zh: "真人电影质感，35mm胶片颗粒感，浅景深，自然光线，专业摄影机质感，4K超清",
    en: "Live-action cinematic quality, 35mm film grain, shallow depth of field, natural lighting, professional cinema camera look, 4K ultra HD",
  },
};

// ─── PropEditor ───────────────────────────────────────────────────────────────
function PropEditor({ props, onChange }: { props: string[]; onChange: (p: string[]) => void }) {
  const [adding, setAdding] = useState(false);
  const [newVal, setNewVal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = useCallback(() => {
    const v = newVal.trim();
    if (v && !props.includes(v)) onChange([...props, v]);
    setNewVal("");
    setAdding(false);
  }, [newVal, props, onChange]);

  return (
    <div>
      <div className="flex items-center gap-1 mb-1.5">
        <Package className="w-3 h-3" style={{ color: "oklch(0.55 0.01 240)" }} />
        <span className="text-[10px] font-semibold" style={{ color: "oklch(0.55 0.01 240)" }}>关键道具</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {props.length === 0 && !adding && (
          <span className="text-[10px]" style={{ color: "oklch(0.40 0.008 240)" }}>无</span>
        )}
        {props.map(p => (
          <span key={p} className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded group"
            style={{ background: "oklch(0.22 0.006 240)", color: "oklch(0.70 0.008 240)" }}>
            {p}
            <button
              className="opacity-0 group-hover:opacity-100 transition-opacity ml-0.5 hover:text-red-400"
              onClick={() => onChange(props.filter(x => x !== p))}
              title="删除道具"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
        {adding ? (
          <input
            ref={inputRef}
            autoFocus
            value={newVal}
            onChange={e => setNewVal(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") { setAdding(false); setNewVal(""); }
            }}
            onBlur={commit}
            placeholder="道具名称"
            className="text-[10px] px-1.5 py-0.5 rounded outline-none w-20"
            style={{ background: "oklch(0.18 0.006 240)", border: "1px solid oklch(0.55 0.18 290 / 0.5)", color: "oklch(0.88 0.005 60)" }}
          />
        ) : (
          <button
            className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded transition-opacity hover:opacity-80"
            style={{ background: "oklch(0.55 0.18 290 / 0.12)", border: "1px dashed oklch(0.55 0.18 290 / 0.4)", color: "oklch(0.55 0.18 290)" }}
            onClick={() => setAdding(true)}
          >
            <Plus className="w-2.5 h-2.5" />添加
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  amber: "oklch(0.75 0.17 65)",
  dim: "oklch(0.55 0.01 240)",
  sub: "oklch(0.70 0.008 240)",
  text: "oklch(0.88 0.005 60)",
  mono: "'JetBrains Mono', monospace" as const,
  grotesk: "'Space Grotesk', sans-serif" as const,
  card: { background: "oklch(0.17 0.006 240)", border: "1px solid oklch(0.28 0.008 240)", borderRadius: "8px" } as React.CSSProperties,
};

// ─── Phase1 ───────────────────────────────────────────────────────────────────
export default function Phase1() {
  const {
    projectInfo, updateProjectInfo, scriptText, setScriptText,
    scriptAnalysis, analyzeScript, analyzeScriptWithAI, updateEpisode,
    markPhaseComplete, setActivePhase
  } = useProject();

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isFileLoading, setIsFileLoading] = useState(false);
  const [resultsExpanded, setResultsExpanded] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    setIsFileLoading(true);
    try {
      const fmt = detectFormat(file);
      const text = await extractTextFromFile(file);
      setScriptText(text);
      setUploadedFileName(file.name);
      toast.success(`已加载剧本：${file.name}（${formatLabel(fmt)}）`);
    } catch (err) {
      toast.error(`解析失败：${err instanceof Error ? err.message : "未知错误"}`);
    } finally {
      setIsFileLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const analyzeScriptMutation = trpc.ai.analyzeScript.useMutation();
  const analyzeUtils = trpc.useUtils();

  const handleAnalyze = async () => {
    if (!scriptText.trim()) { toast.error("请先输入或上传剧本内容"); return; }
    setIsAnalyzing(true);
    try {
      const result = await analyzeScriptMutation.mutateAsync({
        scriptText,
        styleZh: projectInfo.styleZh,
      });
      analyzeScriptWithAI(result);
      toast.success(`AI 解析完成，共识别 ${result.episodes.length} 集，${result.characters.length} 个角色`);
      analyzeUtils.auth.me.invalidate();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "未知错误";
      if (msg.includes("积分不足")) {
        toast.error(msg);
        return;
      }
      toast.error(`AI 解析失败，使用本地规则解析：${msg}`);
      analyzeScript();
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSelectStyle = (catId: string) => {
    const fixed = STYLE_FIXED_PROMPTS[catId];
    if (fixed) {
      updateProjectInfo({
        styleCategory: catId,
        styleSubtype: "",
        styleZh: fixed.zh,
        styleEn: fixed.en,
      });
    }
  };

  const handleSelectMarket = (marketId: string) => {
    updateProjectInfo({ market: marketId });
  };

  const handleSelectOrientation = (orientation: "landscape" | "portrait") => {
    const ratio = orientation === "landscape" ? "16:9 横屏" : "9:16 竖屏";
    updateProjectInfo({ orientation, ratio });
  };

  const handleComplete = () => {
    if (!projectInfo.title) { toast.error("请填写项目名称"); return; }
    if (!projectInfo.styleCategory) { toast.error("请选择视觉风格（2D / 3D / CG / 真人）"); return; }
    if (!scriptAnalysis.isAnalyzed) { toast.error("请先完成剧本解析"); return; }
    markPhaseComplete("phase1");
    setActivePhase("phase2");
  };

  const currentMarket = MARKETS.find(m => m.id === projectInfo.market) || MARKETS[0];
  const isLandscape = projectInfo.orientation === "landscape";

  return (
    <div className="space-y-8">
      {/* Phase header */}
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-12 h-12 rounded flex items-center justify-center text-lg font-bold"
          style={{ background: "oklch(0.75 0.17 65 / 0.15)", border: "1px solid oklch(0.75 0.17 65 / 0.4)", color: S.amber, fontFamily: S.mono }}>
          01
        </div>
        <div>
          <h2 className="text-xl font-bold" style={{ color: S.text, fontFamily: S.grotesk }}>项目定义</h2>
          <p className="text-sm mt-1" style={{ color: S.dim }}>
            填写项目信息 → 选择市场/画幅/风格 → 上传剧本 → AI 自动解析
          </p>
        </div>
      </div>

      {/* ── 1.1 项目基础信息 ──────────────────────────────────────────────────── */}
      <section>
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: S.amber, fontFamily: S.grotesk }}>
          <span className="px-2 py-0.5 rounded text-[10px]"
            style={{ background: "oklch(0.75 0.17 65 / 0.15)", border: "1px solid oklch(0.75 0.17 65 / 0.3)" }}>1.1</span>
          项目基础信息
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 项目名称 */}
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs" style={{ color: S.dim }}>项目名称 <span style={{ color: "oklch(0.65 0.2 25)" }}>*</span></Label>
            <Input
              value={projectInfo.title}
              onChange={e => updateProjectInfo({ title: e.target.value })}
              placeholder="输入项目名称，如：星际战记 第一季"
              className="text-sm h-9"
              style={{ background: "oklch(0.17 0.006 240)", border: "1px solid oklch(0.28 0.008 240)", color: S.text }}
            />
          </div>
          {/* 类型 */}
          <div className="space-y-1.5">
            <Label className="text-xs" style={{ color: S.dim }}>内容类型</Label>
            <Select value={projectInfo.type} onValueChange={v => updateProjectInfo({ type: v })}>
              <SelectTrigger className="h-9 text-sm" style={{ background: "oklch(0.17 0.006 240)", border: "1px solid oklch(0.28 0.008 240)", color: S.text }}>
                <SelectValue placeholder="选择类型" />
              </SelectTrigger>
              <SelectContent style={{ background: "oklch(0.17 0.006 240)", border: "1px solid oklch(0.28 0.008 240)" }}>
                {["短剧", "动画", "广告", "MV", "纪录片", "预告片"].map(t => (
                  <SelectItem key={t} value={t} className="text-sm" style={{ color: S.text }}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* 目标平台 */}
          <div className="space-y-1.5">
            <Label className="text-xs" style={{ color: S.dim }}>目标平台</Label>
            <Select value={projectInfo.platform} onValueChange={v => updateProjectInfo({ platform: v })}>
              <SelectTrigger className="h-9 text-sm" style={{ background: "oklch(0.17 0.006 240)", border: "1px solid oklch(0.28 0.008 240)", color: S.text }}>
                <SelectValue placeholder="选择平台" />
              </SelectTrigger>
              <SelectContent style={{ background: "oklch(0.17 0.006 240)", border: "1px solid oklch(0.28 0.008 240)" }}>
                {["抖音", "B站", "YouTube", "小红书", "微信视频号", "院线"].map(p => (
                  <SelectItem key={p} value={p} className="text-sm" style={{ color: S.text }}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* ── 1.2 目标市场 ──────────────────────────────────────────────────────── */}
      <section>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: S.amber, fontFamily: S.grotesk }}>
          <span className="px-2 py-0.5 rounded text-[10px]"
            style={{ background: "oklch(0.75 0.17 65 / 0.15)", border: "1px solid oklch(0.75 0.17 65 / 0.3)" }}>1.2</span>
          目标市场
          <Globe className="w-3.5 h-3.5" style={{ color: S.amber }} />
        </h3>
        <p className="text-[10px] mb-3" style={{ color: S.dim }}>
          市场决定配音/旁白语言。选择后，AI 生成的旁白（VO）和配音提示词将自动使用对应语言。
        </p>
        <div className="grid grid-cols-5 gap-2">
          {MARKETS.map(m => (
            <button key={m.id} onClick={() => handleSelectMarket(m.id)}
              className="flex flex-col items-center gap-1 p-2.5 rounded transition-all"
              style={{
                background: projectInfo.market === m.id ? "oklch(0.75 0.17 65 / 0.15)" : "oklch(0.17 0.006 240)",
                border: `1px solid ${projectInfo.market === m.id ? "oklch(0.75 0.17 65 / 0.7)" : "oklch(0.28 0.008 240)"}`,
              }}>
              <span className="text-lg leading-none">{m.flag}</span>
              <span className="text-[10px] font-medium" style={{ color: projectInfo.market === m.id ? S.amber : S.sub }}>{m.label}</span>
              <span className="text-[9px]" style={{ color: S.dim }}>{m.voLang}</span>
            </button>
          ))}
        </div>
        {projectInfo.market && (
          <div className="mt-2 p-2 rounded text-[10px] flex items-center gap-2"
            style={{ background: "oklch(0.75 0.17 65 / 0.06)", border: "1px solid oklch(0.75 0.17 65 / 0.2)" }}>
            <span style={{ color: S.amber }}>配音/旁白语言：</span>
            <span style={{ color: S.sub }}>{currentMarket.voLang}（{currentMarket.voLangEn}）</span>
          </div>
        )}
      </section>

      {/* ── 1.3 画幅方向 ──────────────────────────────────────────────────────── */}
      <section>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: S.amber, fontFamily: S.grotesk }}>
          <span className="px-2 py-0.5 rounded text-[10px]"
            style={{ background: "oklch(0.75 0.17 65 / 0.15)", border: "1px solid oklch(0.75 0.17 65 / 0.3)" }}>1.3</span>
          画幅方向
        </h3>
        <p className="text-[10px] mb-3" style={{ color: S.dim }}>
          画幅决定资产生成比例和视听语言方案。横屏使用电影级宽画幅叙事，竖屏使用竖向沉浸式构图。
        </p>
        <div className="grid grid-cols-2 gap-4">
          {/* 竖屏 */}
          <button onClick={() => handleSelectOrientation("portrait")}
            className="flex items-center gap-4 p-4 rounded transition-all"
            style={{
              background: !isLandscape ? "oklch(0.60 0.18 240 / 0.12)" : "oklch(0.17 0.006 240)",
              border: `2px solid ${!isLandscape ? "oklch(0.60 0.18 240 / 0.8)" : "oklch(0.28 0.008 240)"}`,
            }}>
            <Smartphone className="w-8 h-8 flex-shrink-0" style={{ color: !isLandscape ? "oklch(0.60 0.18 240)" : S.dim }} />
            <div className="text-left">
              <div className="text-sm font-bold mb-0.5" style={{ color: !isLandscape ? "oklch(0.60 0.18 240)" : S.sub, fontFamily: S.grotesk }}>
                竖屏 9:16
              </div>
              <div className="text-[10px]" style={{ color: S.dim }}>抖音 / 小红书 / 短视频</div>
              <div className="text-[9px] mt-1" style={{ color: S.dim }}>资产比例：人物 9:16 · 场景 9:16 · 道具 9:16</div>
            </div>
          </button>
          {/* 横屏 */}
          <button onClick={() => handleSelectOrientation("landscape")}
            className="flex items-center gap-4 p-4 rounded transition-all"
            style={{
              background: isLandscape ? "oklch(0.65 0.2 145 / 0.12)" : "oklch(0.17 0.006 240)",
              border: `2px solid ${isLandscape ? "oklch(0.65 0.2 145 / 0.8)" : "oklch(0.28 0.008 240)"}`,
            }}>
            <Monitor className="w-8 h-8 flex-shrink-0" style={{ color: isLandscape ? "oklch(0.65 0.2 145)" : S.dim }} />
            <div className="text-left">
              <div className="text-sm font-bold mb-0.5" style={{ color: isLandscape ? "oklch(0.65 0.2 145)" : S.sub, fontFamily: S.grotesk }}>
                横屏 16:9
              </div>
              <div className="text-[10px]" style={{ color: S.dim }}>B站 / YouTube / 院线</div>
              <div className="text-[9px] mt-1" style={{ color: S.dim }}>资产比例：人物 9:16 · 场景 16:9 · 道具 16:9</div>
            </div>
          </button>
        </div>
      </section>

      {/* ── 1.4 视觉风格（大风格，固定4类） ─────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: S.amber, fontFamily: S.grotesk }}>
            <span className="px-2 py-0.5 rounded text-[10px]"
              style={{ background: "oklch(0.75 0.17 65 / 0.15)", border: "1px solid oklch(0.75 0.17 65 / 0.3)" }}>1.4</span>
            视觉风格
          </h3>
          <Badge variant="outline" className="text-[10px] px-2 py-0"
            style={{ borderColor: "oklch(0.577 0.245 27.325 / 0.5)", color: "oklch(0.7 0.2 27)" }}>
            <AlertTriangle className="w-2.5 h-2.5 mr-1" />
            禁止引用具体作品名称
          </Badge>
        </div>
        <p className="text-[10px] mb-3" style={{ color: S.dim }}>
          选择后将形成固定风格提示词，嵌入后续所有资产、分镜和视频提示词中，确保风格一致性。
        </p>
        <div className="grid grid-cols-4 gap-3">
          {STYLE_CATEGORIES.map(cat => {
            const fixed = STYLE_FIXED_PROMPTS[cat.id];
            const isSelected = projectInfo.styleCategory === cat.id;
            return (
              <button key={cat.id} onClick={() => handleSelectStyle(cat.id)}
                className="text-left p-3 rounded transition-all duration-200 space-y-1.5"
                style={{
                  background: isSelected ? "oklch(0.75 0.17 65 / 0.15)" : "oklch(0.17 0.006 240)",
                  border: `2px solid ${isSelected ? "oklch(0.75 0.17 65 / 0.7)" : "oklch(0.28 0.008 240)"}`,
                }}>
                <div className="text-sm font-bold" style={{ color: isSelected ? S.amber : S.text, fontFamily: S.grotesk }}>
                  {cat.label}
                </div>
                <div className="text-[10px]" style={{ color: S.dim }}>{fixed?.desc || cat.desc}</div>
                {isSelected && (
                  <div className="flex items-center gap-1 mt-1">
                    <CheckCircle2 className="w-3 h-3" style={{ color: "oklch(0.65 0.2 145)" }} />
                    <span className="text-[9px]" style={{ color: "oklch(0.65 0.2 145)" }}>已选定</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
        {/* 固定提示词预览 */}
        {projectInfo.styleCategory && STYLE_FIXED_PROMPTS[projectInfo.styleCategory] && (
          <div className="mt-3 p-3 rounded space-y-1.5"
            style={{ background: "oklch(0.12 0.005 240)", border: "1px solid oklch(0.22 0.006 240)" }}>
            <div className="text-[9px] font-semibold" style={{ color: S.dim, fontFamily: S.mono }}>固定风格提示词（自动嵌入所有后续生成）</div>
            <div className="text-[10px]" style={{ color: S.sub, fontFamily: S.mono }}>{STYLE_FIXED_PROMPTS[projectInfo.styleCategory].zh}</div>
            <div className="text-[10px]" style={{ color: "oklch(0.60 0.01 240)", fontFamily: S.mono }}>{STYLE_FIXED_PROMPTS[projectInfo.styleCategory].en}</div>
          </div>
        )}
      </section>

      {/* ── 1.5 剧本上传与解析 ────────────────────────────────────────────────── */}
      <section>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: S.amber, fontFamily: S.grotesk }}>
          <span className="px-2 py-0.5 rounded text-[10px]"
            style={{ background: "oklch(0.75 0.17 65 / 0.15)", border: "1px solid oklch(0.75 0.17 65 / 0.3)" }}>1.5</span>
          剧本上传与解析
        </h3>

        {/* Upload area */}
        <div className="mb-3 p-5 rounded cursor-pointer transition-all"
          style={{
            background: isDragging ? "oklch(0.75 0.17 65 / 0.06)" : "oklch(0.17 0.006 240)",
            border: `2px dashed ${isDragging ? "oklch(0.75 0.17 65 / 0.7)" : "oklch(0.35 0.008 240)"}`
          }}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}>
          <div className="flex items-center gap-4 mb-3">
            <Upload className="w-6 h-6 flex-shrink-0" style={{ color: isFileLoading ? S.amber : uploadedFileName ? "oklch(0.65 0.2 145)" : S.dim }} />
            <div>
              <p className="text-sm font-medium" style={{ color: "oklch(0.80 0.005 60)" }}>
                {isFileLoading ? "正在解析文件..." : uploadedFileName ? uploadedFileName : "点击或拖拽上传剧本文件"}
              </p>
              <p className="text-xs" style={{ color: uploadedFileName ? "oklch(0.65 0.2 145)" : "oklch(0.45 0.008 240)" }}>
                {uploadedFileName ? `剧本已加载，共 ${scriptText.length} 字` : "支持多种格式，或直接在下方粘贴文本"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["txt", "md", "fountain", "docx", "pdf"] as const).map(fmt => (
              <span key={fmt} style={{ background: "oklch(0.22 0.006 240)", border: "1px solid oklch(0.28 0.008 240)", borderRadius: 6, padding: "2px 8px", fontSize: 11, color: "oklch(0.65 0.01 240)", fontFamily: S.mono }}>
                .{fmt}
              </span>
            ))}
          </div>
          <input ref={fileInputRef} type="file" accept={ACCEPTED_FORMATS} className="hidden" onChange={handleFileUpload} />
        </div>

        {/* 剧本文本输入 */}
        <textarea
          value={scriptText}
          onChange={e => setScriptText(e.target.value)}
          placeholder="或在此直接粘贴剧本内容..."
          rows={6}
          className="w-full text-xs resize-none rounded p-3 outline-none"
          style={{ background: "oklch(0.17 0.006 240)", border: "1px solid oklch(0.28 0.008 240)", color: S.text, fontFamily: S.mono }}
        />

        <div className="flex items-center gap-3 flex-wrap mt-3">
          <Button onClick={handleAnalyze} disabled={isAnalyzing || !scriptText.trim()}
            className="flex items-center gap-2"
            style={{ background: S.amber, color: "oklch(0.1 0.005 240)", fontFamily: S.grotesk, fontWeight: 600 }}>
            <Wand2 className="w-4 h-4" />
            {isAnalyzing ? "解析中..." : "AI 解析剧本"}
          </Button>
          <AIEstimateHint
            isLoading={isAnalyzing}
            min={GEMINI_ESTIMATE_SECS.analyzeScript.min}
            max={GEMINI_ESTIMATE_SECS.analyzeScript.max}
          />
        </div>
      </section>

      {/* ── 1.6 解析结果（可折叠） ────────────────────────────────────────────── */}
      {scriptAnalysis.isAnalyzed && scriptAnalysis.episodes.length > 0 && (
        <section>
          <button
            className="w-full flex items-center gap-2 mb-3 text-left"
            onClick={() => setResultsExpanded(prev => !prev)}
          >
            <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: S.amber, fontFamily: S.grotesk }}>
              <span className="px-2 py-0.5 rounded text-[10px]"
                style={{ background: "oklch(0.75 0.17 65 / 0.15)", border: "1px solid oklch(0.75 0.17 65 / 0.3)" }}>1.6</span>
              解析结果
              <Badge className="text-[10px] px-2 py-0"
                style={{ background: "oklch(0.65 0.2 145 / 0.2)", color: "oklch(0.65 0.2 145)", border: "1px solid oklch(0.65 0.2 145 / 0.4)" }}>
                <CheckCircle2 className="w-2.5 h-2.5 mr-1" />
                已解析 {scriptAnalysis.episodes.length} 集
              </Badge>
            </h3>
            <span className="ml-auto text-xs" style={{ color: S.dim }}>
              {resultsExpanded ? "收起 ▲" : "展开查看 ▼"}
            </span>
          </button>
          {resultsExpanded && (
            <>
              {scriptAnalysis.globalCharacters.length > 0 && (
                <div className="mb-4 p-3 rounded" style={S.card}>
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-3.5 h-3.5" style={{ color: S.amber }} />
                    <span className="text-xs font-semibold" style={{ color: S.amber, fontFamily: S.grotesk }}>
                      全局人物（{scriptAnalysis.globalCharacters.length}）
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {scriptAnalysis.globalCharacters.map(name => (
                      <span key={name} className="px-2 py-0.5 rounded text-xs"
                        style={{ background: "oklch(0.22 0.006 240)", color: "oklch(0.80 0.005 60)", border: "1px solid oklch(0.30 0.008 240)" }}>
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-3">
                {scriptAnalysis.episodes.map(ep => (
                  <div key={ep.id} className="rounded overflow-hidden" style={{ border: "1px solid oklch(0.28 0.008 240)" }}>
                    <div className="flex items-center gap-3 px-4 py-2.5"
                      style={{ background: "oklch(0.15 0.006 240)", borderBottom: "1px solid oklch(0.28 0.008 240)" }}>
                      <span className="text-xs font-bold" style={{ color: S.amber, fontFamily: S.mono }}>
                        EP_{String(ep.number).padStart(2, "0")}
                      </span>
                      <Input value={ep.title} onChange={e => updateEpisode(ep.id, { title: e.target.value })}
                        className="h-6 text-xs flex-1 max-w-[200px]"
                        style={{ background: "transparent", border: "none", color: S.text, padding: "0" }} />
                      <div className="flex items-center gap-1.5 ml-auto">
                        <span className="text-[10px] px-2 py-0.5 rounded"
                          style={{ background: "oklch(0.22 0.006 240)", color: "oklch(0.60 0.01 240)" }}>
                          约 {ep.duration} 分钟
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded"
                          style={{ background: "oklch(0.22 0.006 240)", color: "oklch(0.60 0.01 240)" }}>
                          约 {Math.round(ep.duration * 20)}–{Math.round(ep.duration * 30)} 个镜头
                        </span>
                      </div>
                    </div>
                    <div className="p-3 grid grid-cols-3 gap-3">
                      <div>
                        <div className="flex items-center gap-1 mb-1.5">
                          <Users className="w-3 h-3" style={{ color: S.dim }} />
                          <span className="text-[10px] font-semibold" style={{ color: S.dim }}>出场人物</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {ep.characters.length > 0 ? ep.characters.map(c => (
                            <span key={c} className="text-[10px] px-1.5 py-0.5 rounded"
                              style={{ background: "oklch(0.22 0.006 240)", color: S.sub }}>{c}</span>
                          )) : <span className="text-[10px]" style={{ color: "oklch(0.40 0.008 240)" }}>未识别</span>}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-1 mb-1.5">
                          <MapPin className="w-3 h-3" style={{ color: S.dim }} />
                          <span className="text-[10px] font-semibold" style={{ color: S.dim }}>主要场景</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {ep.scenes.map(s => (
                            <span key={s} className="text-[10px] px-1.5 py-0.5 rounded"
                              style={{ background: "oklch(0.22 0.006 240)", color: S.sub }}>{s}</span>
                          ))}
                        </div>
                      </div>
                      <PropEditor
                        props={ep.props}
                        onChange={newProps => updateEpisode(ep.id, { props: newProps })}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {/* Complete button */}
      <div className="flex justify-end pt-2">
        <Button onClick={handleComplete}
          className="flex items-center gap-2 px-6"
          style={{ background: S.amber, color: "oklch(0.1 0.005 240)", fontFamily: S.grotesk, fontWeight: 600 }}>
          <CheckCircle2 className="w-4 h-4" />
          完成本阶段，进入资产设计
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
