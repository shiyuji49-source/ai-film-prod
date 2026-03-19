// DESIGN: "导演手册" 工业风暗色系 — Phase 3: Storyboarding + Timeline
import { useProject } from "@/contexts/ProjectContext";
import { SHOT_TYPES, SHOT_SIZES, CAMERA_MOVEMENTS, SHOT_RATIOS } from "@/lib/workflowData";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, ChevronRight, ChevronLeft, Plus, Trash2, Wand2, BarChart2, List, Loader2, BookOpen, X, Search } from "lucide-react";
import { useState, useMemo, useRef, useEffect } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { AIEstimateHint } from "@/components/AIEstimateHint";
import { GEMINI_ESTIMATE_SECS } from "@shared/const";

// ─── Emotion Timeline Component ───────────────────────────────────────────────
function EmotionTimeline({ shots }: { shots: Array<{ number: number; emotion: string; emotionLevel: number; duration: number; type: string }> }) {
  if (shots.length === 0) return (
    <div className="flex items-center justify-center h-32 rounded"
      style={{ border: "1px dashed oklch(0.28 0.008 240)", color: "oklch(0.40 0.008 240)" }}>
      <p className="text-xs">生成分镜后显示情绪曲线</p>
    </div>
  );

  const maxLevel = 5;
  const totalDur = shots.reduce((s, sh) => s + sh.duration, 0);
  const svgH = 120;
  const svgW = 800;
  const padX = 40;
  const padY = 16;
  const chartH = svgH - padY * 2;
  const chartW = svgW - padX * 2;

  // Build points
  let cumDur = 0;
  const points = shots.map(sh => {
    const x = padX + (cumDur / totalDur) * chartW;
    const y = padY + ((maxLevel - sh.emotionLevel) / (maxLevel - 1)) * chartH;
    cumDur += sh.duration;
    return { x, y, shot: sh };
  });
  // Add final point
  points.push({ x: padX + chartW, y: points[points.length - 1].y, shot: shots[shots.length - 1] });

  // Build SVG path
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaD = `${pathD} L ${(padX + chartW).toFixed(1)} ${(padY + chartH).toFixed(1)} L ${padX.toFixed(1)} ${(padY + chartH).toFixed(1)} Z`;

  // Color by emotion level
  const getColor = (level: number) => {
    if (level <= 1) return "oklch(0.60 0.01 240)";
    if (level <= 2) return "oklch(0.65 0.15 200)";
    if (level <= 3) return "oklch(0.70 0.18 85)";
    if (level <= 4) return "oklch(0.75 0.17 65)";
    return "oklch(0.65 0.2 25)";
  };

  const EMOTION_LABELS = ["", "平静", "铺垫", "紧张", "高燃", "爆发"];

  return (
    <div className="rounded overflow-hidden" style={{ border: "1px solid oklch(0.28 0.008 240)" }}>
      <div className="px-4 py-2.5 flex items-center gap-2"
        style={{ background: "oklch(0.15 0.006 240)", borderBottom: "1px solid oklch(0.28 0.008 240)" }}>
        <BarChart2 className="w-3.5 h-3.5" style={{ color: "oklch(0.75 0.17 65)" }} />
        <span className="text-xs font-semibold" style={{ color: "oklch(0.75 0.17 65)", fontFamily: "'Space Grotesk', sans-serif" }}>
          情绪曲线 · {shots.length} 个镜头 · 总时长 {totalDur}s
        </span>
        <div className="ml-auto flex items-center gap-3 text-[10px]" style={{ color: "oklch(0.45 0.008 240)" }}>
          {[1, 2, 3, 4, 5].map(l => (
            <span key={l} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: getColor(l) }} />
              {EMOTION_LABELS[l]}
            </span>
          ))}
        </div>
      </div>
      <div className="p-3" style={{ background: "oklch(0.12 0.005 240)" }}>
        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full" style={{ height: "120px" }}>
          {/* Grid lines */}
          {[1, 2, 3, 4, 5].map(level => {
            const y = padY + ((maxLevel - level) / (maxLevel - 1)) * chartH;
            return (
              <g key={level}>
                <line x1={padX} y1={y} x2={padX + chartW} y2={y}
                  stroke="oklch(0.22 0.006 240)" strokeWidth="0.5" strokeDasharray="4,4" />
                <text x={padX - 4} y={y + 3} textAnchor="end" fontSize="8"
                  fill="oklch(0.40 0.008 240)" fontFamily="JetBrains Mono, monospace">
                  {EMOTION_LABELS[level]}
                </text>
              </g>
            );
          })}
          {/* Area fill */}
          <path d={areaD} fill="oklch(0.75 0.17 65 / 0.08)" />
          {/* Line */}
          <path d={pathD} fill="none" stroke="oklch(0.75 0.17 65)" strokeWidth="1.5" strokeLinejoin="round" />
          {/* Points */}
          {points.slice(0, -1).map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="3"
              fill={getColor(p.shot.emotionLevel)}
              stroke="oklch(0.12 0.005 240)" strokeWidth="1.5">
              <title>{`镜头${p.shot.number}: ${p.shot.emotion} (${p.shot.type})`}</title>
            </circle>
          ))}
          {/* Shot type markers at bottom */}
          {points.slice(0, -1).map((p, i) => (
            <text key={`t${i}`} x={p.x} y={svgH - 2} textAnchor="middle" fontSize="6"
              fill="oklch(0.35 0.008 240)" fontFamily="JetBrains Mono, monospace">
              {p.shot.number}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}

// ─── Shot Row Component ────────────────────────────────────────────────────────
function ShotRow({ shot, onUpdate, onRemove }: {
  shot: ReturnType<typeof useProject>["shots"][0];
  onUpdate: (data: Parameters<ReturnType<typeof useProject>["updateShot"]>[1]) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const emotionColors: Record<number, string> = {
    1: "oklch(0.60 0.01 240)", 2: "oklch(0.65 0.15 200)",
    3: "oklch(0.70 0.18 85)", 4: "oklch(0.75 0.17 65)", 5: "oklch(0.65 0.2 25)",
  };
  const ec = emotionColors[shot.emotionLevel] || "oklch(0.60 0.01 240)";

  return (
    <div className="rounded overflow-hidden" style={{ border: "1px solid oklch(0.28 0.008 240)" }}>
      <div className="flex items-center gap-2 px-3 py-2 cursor-pointer"
        style={{ background: "oklch(0.15 0.006 240)", borderBottom: expanded ? "1px solid oklch(0.28 0.008 240)" : "none" }}
        onClick={() => setExpanded(e => !e)}>
        <span className="text-[10px] font-bold w-10 flex-shrink-0"
          style={{ color: "oklch(0.75 0.17 65)", fontFamily: "'JetBrains Mono', monospace" }}>
          {String(shot.number).padStart(3, "0")}
        </span>
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: ec }} />
        <span className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0"
          style={{ background: "oklch(0.22 0.006 240)", color: "oklch(0.65 0.01 240)" }}>{shot.type}</span>
        <span className="text-[10px] flex-shrink-0" style={{ color: "oklch(0.55 0.01 240)" }}>{shot.size}</span>
        <span className="text-[10px] flex-1 truncate" style={{ color: "oklch(0.65 0.01 240)" }}>{shot.description || "—"}</span>
        <span className="text-[10px] flex-shrink-0" style={{ color: "oklch(0.50 0.01 240)", fontFamily: "'JetBrains Mono', monospace" }}>{shot.duration}s</span>
        <span className="text-[10px] flex-shrink-0" style={{ color: ec }}>{shot.emotion}</span>
        <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="p-1 rounded hover:bg-red-500/10 flex-shrink-0">
          <Trash2 className="w-3 h-3" style={{ color: "oklch(0.55 0.2 25)" }} />
        </button>
      </div>
      {expanded && (
        <div className="p-3 grid grid-cols-2 md:grid-cols-3 gap-2.5">
          {[
            { key: "type", label: "镜头类型", type: "select", options: SHOT_TYPES.map(t => t.name) },
            { key: "size", label: "景别", type: "select", options: SHOT_SIZES.map(s => s.name) },
            { key: "movement", label: "镜头运动", type: "select", options: CAMERA_MOVEMENTS.map(m => m.name) },
            { key: "duration", label: "时长(秒)", type: "number" },
            { key: "emotion", label: "情绪", type: "text", placeholder: "如：热血、燃" },
            { key: "emotionLevel", label: "情绪强度(1-5)", type: "number" },
          ].map(({ key, label, type, options, placeholder }) => (
            <div key={key} className="space-y-1">
              <Label className="text-[10px]" style={{ color: "oklch(0.55 0.01 240)" }}>{label}</Label>
              {type === "select" ? (
                <Select value={String(shot[key as keyof typeof shot])} onValueChange={v => onUpdate({ [key]: v })}>
                  <SelectTrigger className="h-7 text-[10px]" style={{ background: "oklch(0.17 0.006 240)", border: "1px solid oklch(0.28 0.008 240)", color: "oklch(0.88 0.005 60)" }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={{ background: "oklch(0.17 0.006 240)", border: "1px solid oklch(0.28 0.008 240)" }}>
                    {(options || []).map(o => (
                      <SelectItem key={o} value={o} className="text-[10px]" style={{ color: "oklch(0.88 0.005 60)" }}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={String(shot[key as keyof typeof shot])}
                  onChange={e => onUpdate({ [key]: type === "number" ? Number(e.target.value) : e.target.value })}
                  type={type} min={type === "number" ? 1 : undefined} max={key === "emotionLevel" ? 5 : key === "duration" ? 15 : undefined}
                  placeholder={placeholder}
                  className="h-7 text-[10px]"
                  style={{ background: "oklch(0.17 0.006 240)", border: "1px solid oklch(0.28 0.008 240)", color: "oklch(0.88 0.005 60)" }} />
              )}
            </div>
          ))}
          <div className="col-span-2 md:col-span-3 space-y-1">
            <Label className="text-[10px]" style={{ color: "oklch(0.55 0.01 240)" }}>画面描述</Label>
            <Textarea value={shot.description} onChange={e => onUpdate({ description: e.target.value })}
              rows={2} className="text-[10px] resize-none"
              style={{ background: "oklch(0.17 0.006 240)", border: "1px solid oklch(0.28 0.008 240)", color: "oklch(0.88 0.005 60)" }} />
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-[10px]" style={{ color: "oklch(0.55 0.01 240)" }}>VO / 旁白 / 内心独白</Label>
            <Input value={shot.vo} onChange={e => onUpdate({ vo: e.target.value })}
              className="h-7 text-[10px]"
              placeholder="VO:或人物VO:开头的旁白或内心独白"
              style={{ background: "oklch(0.17 0.006 240)", border: "1px solid oklch(0.28 0.008 240)", color: "oklch(0.88 0.005 60)" }} />
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-[10px]" style={{ color: "oklch(0.55 0.01 240)" }}>对话 / 台词</Label>
            <Input value={shot.dialogue || ""} onChange={e => onUpdate({ dialogue: e.target.value })}
              className="h-7 text-[10px]"
              placeholder="人物名:“台词内容”"
              style={{ background: "oklch(0.17 0.006 240)", border: "1px solid oklch(0.28 0.008 240)", color: "oklch(0.88 0.005 60)" }} />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]" style={{ color: "oklch(0.55 0.01 240)" }}>SFX / 音效</Label>
            <Input value={shot.sfx} onChange={e => onUpdate({ sfx: e.target.value })}
              className="h-7 text-[10px]"
              style={{ background: "oklch(0.17 0.006 240)", border: "1px solid oklch(0.28 0.008 240)", color: "oklch(0.88 0.005 60)" }} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
// 从完整剧本中提取指定集的文本片段
function extractEpisodeScript(fullScript: string, episodeNumber: number, episodes: Array<{ number: number; title: string }>): string {
  if (!fullScript.trim()) return "";
  const lines = fullScript.split("\n");
  // 匹配集数标志： EP-01 / 第一集 / Episode 1 等
  const epRegex = /^(EP[\s\-_]?\d+|第\s*[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\d]+\s*集|Episode\s*\d+|第\s*\d+\s*集)/i;
  
  let startLine = -1;
  let endLine = lines.length;
  
  // 找到当集开始行
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (epRegex.test(line)) {
      // 提取集数
      const numMatch = line.match(/\d+/) || line.match(/[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341]/);
      if (numMatch) {
        const chineseNums: Record<string, number> = { '一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10 };
        const raw = numMatch[0];
        const num = chineseNums[raw] ?? parseInt(raw, 10);
        if (num === episodeNumber) startLine = i;
        else if (num === episodeNumber + 1 && startLine !== -1) { endLine = i; break; }
      }
    }
  }
  
  if (startLine === -1) {
    // 找不到集数标志，尝试按标题匹配
    const ep = episodes.find(e => e.number === episodeNumber);
    if (ep?.title) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(ep.title)) { startLine = i; break; }
      }
    }
  }
  
  if (startLine === -1) return fullScript.slice(0, 20000); // fallback: 返回全文前部分
  return lines.slice(startLine, endLine).join("\n");
}

export default function Phase3() {
  const { scriptAnalysis, characters, shots, addShot, updateShot, removeShot,
    addShotsFromAI, markPhaseComplete, setActivePhase, projectInfo, scriptText } = useProject();
  const [activeEpTab, setActiveEpTab] = useState(
    scriptAnalysis.episodes.length > 0 ? scriptAnalysis.episodes[0].id : ""
  );
  const [viewMode, setViewMode] = useState<"list" | "timeline">("list");
  const [generatingEp, setGeneratingEp] = useState<string | null>(null);
  const [scriptPanelOpen, setScriptPanelOpen] = useState(false);
  const [scriptSearch, setScriptSearch] = useState("");
  const scriptContentRef = useRef<HTMLDivElement>(null);

  const generateShotsMutation = trpc.ai.generateShots.useMutation();
  const phase3Utils = trpc.useUtils();

  const episodes = scriptAnalysis.episodes;
  const activeEp = episodes.find(e => e.id === activeEpTab);
  const epShots = useMemo(() => shots.filter(s => s.episodeId === activeEpTab), [shots, activeEpTab]);

  // 当前集对应的原剧本文本
  const currentEpisodeScript = useMemo(() => {
    if (!activeEp) return scriptText;
    return extractEpisodeScript(scriptText, activeEp.number, scriptAnalysis.episodes) || scriptText;
  }, [scriptText, activeEp, scriptAnalysis.episodes]);

  // 将文本转义为 HTML 安全内容，并添加语法高亮
  const renderScript = useMemo(() => {
    // 1. 先对原始文本进行 HTML 转义
    const safe = currentEpisodeScript
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    // 2. 应用语法高亮
    let html = safe
      .replace(/(EP[\s\-_]?\d+|第\s*\d+\s*集)/g, '<span style="color:oklch(0.75 0.17 65);font-weight:700">$1</span>')
      .replace(/(【[^】]+】)/g, '<span style="color:oklch(0.65 0.15 200);font-weight:600">$1</span>')
      .replace(/(「[^」]+」)/g, '<span style="color:oklch(0.70 0.18 85)">$1</span>');
    // 3. 如果有搜索词，在 HTML 安全内容中高亮（要小心不要匹配到标签内部）
    if (scriptSearch.trim()) {
      const escapedSearch = scriptSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // 只匹配文本节点（不在 HTML 标签内部）
      html = html.replace(
        new RegExp(`(${escapedSearch})(?![^<]*>)`, "gi"),
        '<mark style="background:oklch(0.75 0.17 65 / 0.35);color:oklch(0.95 0.005 60);border-radius:2px;padding:0 1px">$1</mark>'
      );
    }
    return html;
  }, [currentEpisodeScript, scriptSearch]);

  // 搜索时自动滚动到第一个匹配项
  useEffect(() => {
    if (scriptSearch && scriptContentRef.current) {
      const mark = scriptContentRef.current.querySelector("mark");
      if (mark) mark.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [renderScript, scriptSearch]);

  const handleAutoGenerate = async () => {
    if (!activeEpTab || !activeEp) { toast.error("请先选择集数"); return; }
    setGeneratingEp(activeEpTab);
    try {
      // 提取当集原剧本文本，确保 AI 严格遵循原剧本内容
      const episodeScript = extractEpisodeScript(scriptText, activeEp.number, scriptAnalysis.episodes);
      const result = await generateShotsMutation.mutateAsync({
        episodeTitle: activeEp.title,
        episodeNumber: activeEp.number,
        episodeSynopsis: activeEp.synopsis,
        durationMinutes: activeEp.duration,
        scenes: activeEp.scenes as string[],
        characters: characters.map(c => c.name),
        styleZh: projectInfo.styleZh || projectInfo.styleCategory || "3D科幻机甲国漫风格",
        styleEn: projectInfo.styleEn || undefined,
        orientation: (projectInfo.orientation as "landscape" | "portrait" | undefined),
        market: projectInfo.market || undefined,
        episodeScript: episodeScript || undefined,
      });
      addShotsFromAI(activeEpTab, result.shots);
      toast.success(`已为「${activeEp.title}」生成 ${result.shots.length} 个分镜`);
      // 刷新积分余额
      phase3Utils.auth.me.invalidate();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "未知错误";
      if (msg.includes("积分不足")) {
        toast.error(msg);
      } else {
        toast.error(`AI 分镜生成失败：${msg}`);
      }
    } finally {
      setGeneratingEp(null);
    }
  };

  const handleComplete = () => {
    markPhaseComplete("phase3");
    setActivePhase("phase4");
  };

  return (
    <div className="relative">
    {/* 原剧本侧边栏 — 固定定位抽屉式面板 */}
    <div
      className="fixed top-0 right-0 h-full z-50 flex"
      style={{ pointerEvents: scriptPanelOpen ? "auto" : "none" }}
    >
      {/* 折叠按鈕 — 始终可点击 */}
      <div
        className="flex-shrink-0 flex items-start pt-24"
        style={{ pointerEvents: "auto" }}
      >
        <button
          onClick={() => setScriptPanelOpen(v => !v)}
          title={scriptPanelOpen ? "收起剧本" : "查看原剧本"}
          className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-l-lg transition-all duration-200"
          style={{
            background: scriptPanelOpen ? "oklch(0.20 0.006 240)" : "oklch(0.75 0.17 65 / 0.15)",
            border: "1px solid oklch(0.75 0.17 65 / 0.4)",
            borderRight: "none",
            color: "oklch(0.75 0.17 65)",
            writingMode: "vertical-rl",
          }}
        >
          {scriptPanelOpen ? (
            <ChevronRight className="w-3.5 h-3.5 mb-1" style={{ writingMode: "horizontal-tb" }} />
          ) : (
            <ChevronLeft className="w-3.5 h-3.5 mb-1" style={{ writingMode: "horizontal-tb" }} />
          )}
          <BookOpen className="w-3.5 h-3.5" style={{ writingMode: "horizontal-tb" }} />
          <span className="text-[10px] tracking-widest font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            原剧本
          </span>
        </button>
      </div>

      {/* 侧边栏面板 */}
      <div
        className="flex flex-col h-full transition-all duration-300 ease-in-out overflow-hidden"
        style={{
          width: scriptPanelOpen ? "380px" : "0px",
          background: "oklch(0.14 0.005 240)",
          borderLeft: "1px solid oklch(0.28 0.008 240)",
          boxShadow: scriptPanelOpen ? "-8px 0 32px oklch(0 0 0 / 0.5)" : "none",
        }}
      >
        {scriptPanelOpen && (
          <>
            {/* 面板标题栏 */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-3"
              style={{ borderBottom: "1px solid oklch(0.22 0.006 240)", background: "oklch(0.16 0.006 240)" }}>
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" style={{ color: "oklch(0.75 0.17 65)" }} />
                <span className="text-sm font-bold" style={{ color: "oklch(0.88 0.005 60)", fontFamily: "'Space Grotesk', sans-serif" }}>
                  原剧本
                </span>
                {activeEp && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{ background: "oklch(0.75 0.17 65 / 0.15)", color: "oklch(0.75 0.17 65)", fontFamily: "'JetBrains Mono', monospace" }}>
                    EP_{String(activeEp.number).padStart(2, "0")}
                  </span>
                )}
              </div>
              <button onClick={() => setScriptPanelOpen(false)} className="p-1 rounded hover:bg-white/5"
                style={{ color: "oklch(0.50 0.01 240)" }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 搜索栏 */}
            <div className="flex-shrink-0 px-3 py-2" style={{ borderBottom: "1px solid oklch(0.20 0.006 240)" }}>
              <div className="flex items-center gap-2 px-2 py-1.5 rounded"
                style={{ background: "oklch(0.18 0.006 240)", border: "1px solid oklch(0.28 0.008 240)" }}>
                <Search className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "oklch(0.45 0.008 240)" }} />
                <input
                  type="text"
                  value={scriptSearch}
                  onChange={e => setScriptSearch(e.target.value)}
                  placeholder="搜索剧本内容…"
                  className="flex-1 bg-transparent text-xs outline-none"
                  style={{ color: "oklch(0.85 0.005 60)", caretColor: "oklch(0.75 0.17 65)" }}
                />
                {scriptSearch && (
                  <button onClick={() => setScriptSearch("")} className="flex-shrink-0">
                    <X className="w-3 h-3" style={{ color: "oklch(0.45 0.008 240)" }} />
                  </button>
                )}
              </div>
            </div>

            {/* 剧本内容 */}
            <div ref={scriptContentRef} className="flex-1 overflow-y-auto px-4 py-3"
              style={{ scrollbarWidth: "thin", scrollbarColor: "oklch(0.28 0.008 240) transparent" }}>
              {currentEpisodeScript ? (
                <div
                  className="text-xs leading-relaxed whitespace-pre-wrap"
                  style={{ color: "oklch(0.70 0.008 240)", fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", lineHeight: "1.8" }}
                  dangerouslySetInnerHTML={{ __html: renderScript }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-32 gap-2"
                  style={{ color: "oklch(0.40 0.008 240)" }}>
                  <BookOpen className="w-8 h-8 opacity-30" />
                  <p className="text-xs">请先在阶段一上传剧本</p>
                </div>
              )}
            </div>

            {/* 底部提示 */}
            <div className="flex-shrink-0 px-4 py-2" style={{ borderTop: "1px solid oklch(0.20 0.006 240)" }}>
              <p className="text-[10px]" style={{ color: "oklch(0.35 0.008 240)", fontFamily: "'JetBrains Mono', monospace" }}>
                显示当前集剧本内容 · 可搜索关键词
              </p>
            </div>
          </>
        )}
      </div>
    </div>

    <div className="space-y-8">
      {/* Phase header */}
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-12 h-12 rounded flex items-center justify-center text-lg font-bold"
          style={{ background: "oklch(0.75 0.17 65 / 0.15)", border: "1px solid oklch(0.75 0.17 65 / 0.4)", color: "oklch(0.75 0.17 65)", fontFamily: "'JetBrains Mono', monospace" }}>
          03
        </div>
        <div>
          <h2 className="text-xl font-bold" style={{ color: "oklch(0.92 0.005 60)", fontFamily: "'Space Grotesk', sans-serif" }}>
            分镜设计
          </h2>
          <p className="text-sm mt-1" style={{ color: "oklch(0.55 0.01 240)" }}>
            按集数自动生成分镜 · 可视化情绪曲线 · 支持手动精调
          </p>
        </div>
      </div>

      {episodes.length === 0 ? (
        <div className="text-center py-12 rounded"
          style={{ border: "1px dashed oklch(0.28 0.008 240)", color: "oklch(0.45 0.008 240)" }}>
          <p className="text-sm">请先在阶段一完成剧本解析</p>
        </div>
      ) : (
        <>
          {/* Episode tabs */}
          <Tabs value={activeEpTab} onValueChange={v => { setActiveEpTab(v); setViewMode("list"); }}>
            <div className="flex items-center justify-between mb-3">
              <TabsList className="h-8" style={{ background: "oklch(0.17 0.006 240)" }}>
                {episodes.map(ep => (
                  <TabsTrigger key={ep.id} value={ep.id} className="text-xs h-7 px-3"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    EP_{String(ep.number).padStart(2, "0")}
                    {shots.filter(s => s.episodeId === ep.id).length > 0 && (
                      <span className="ml-1 text-[9px] px-1 rounded"
                        style={{ background: "oklch(0.75 0.17 65 / 0.2)", color: "oklch(0.75 0.17 65)" }}>
                        {shots.filter(s => s.episodeId === ep.id).length}
                      </span>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
              <div className="flex items-center gap-2">
                <Button onClick={() => setViewMode(v => v === "list" ? "timeline" : "list")} size="sm" variant="outline"
                  className="flex items-center gap-1.5 text-xs h-7"
                  style={{ borderColor: "oklch(0.35 0.008 240)", color: "oklch(0.70 0.008 240)", background: "transparent" }}>
                  {viewMode === "list" ? <BarChart2 className="w-3 h-3" /> : <List className="w-3 h-3" />}
                  {viewMode === "list" ? "情绪曲线" : "分镜列表"}
                </Button>
              </div>
            </div>

            {episodes.map(ep => (
              <TabsContent key={ep.id} value={ep.id} className="mt-0 space-y-4">
                {/* Episode info bar */}
                <div className="flex items-center justify-between p-3 rounded"
                  style={{ background: "oklch(0.17 0.006 240)", border: "1px solid oklch(0.28 0.008 240)" }}>
                  <div>
                    <span className="text-sm font-semibold" style={{ color: "oklch(0.88 0.005 60)", fontFamily: "'Space Grotesk', sans-serif" }}>
                      {ep.title}
                    </span>
                    <span className="text-xs ml-3" style={{ color: "oklch(0.50 0.01 240)" }}>
                      {ep.duration} 分钟 · 建议 {ep.duration * 20}–{ep.duration * 30} 个镜头
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button onClick={handleAutoGenerate} size="sm" disabled={generatingEp === ep.id}
                      className="flex items-center gap-1.5 text-xs h-7"
                      style={{ background: "oklch(0.75 0.17 65)", color: "oklch(0.1 0.005 240)", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600 }}>
                      {generatingEp === ep.id ? (
                        <><Loader2 className="w-3 h-3 animate-spin" />AI 生成中…</>
                      ) : (
                        <><Wand2 className="w-3 h-3" />AI 自动生成分镇</>
                      )}
                    </Button>
                    <AIEstimateHint isLoading={generatingEp === ep.id} min={GEMINI_ESTIMATE_SECS.generateShots.min} max={GEMINI_ESTIMATE_SECS.generateShots.max} />
                    <Button onClick={() => addShot(ep.id)} size="sm" variant="outline"
                      className="flex items-center gap-1.5 text-xs h-7"
                      style={{ borderColor: "oklch(0.35 0.008 240)", color: "oklch(0.70 0.008 240)", background: "transparent" }}>
                      <Plus className="w-3 h-3" />
                      手动添加
                    </Button>
                  </div>
                </div>

                {viewMode === "timeline" ? (
                  <EmotionTimeline shots={epShots.map(s => ({ number: s.number, emotion: s.emotion, emotionLevel: s.emotionLevel, duration: s.duration, type: s.type }))} />
                ) : (
                  <div className="space-y-1.5">
                    {epShots.length === 0 ? (
                      <div className="text-center py-10 rounded"
                        style={{ border: "1px dashed oklch(0.28 0.008 240)", color: "oklch(0.45 0.008 240)" }}>
                        <p className="text-sm">点击「AI 自动生成分镜」快速创建完整分镜表</p>
                        <p className="text-xs mt-1" style={{ color: "oklch(0.38 0.008 240)" }}>
                          将根据集数时长（{ep.duration} 分钟）和类型自动生成约 {ep.duration * 25} 个镜头
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* Shot list header */}
                        <div className="flex items-center gap-2 px-3 py-1.5 text-[10px] uppercase tracking-widest"
                          style={{ color: "oklch(0.40 0.008 240)", fontFamily: "'JetBrains Mono', monospace" }}>
                          <span className="w-10">编号</span>
                          <span className="w-2"></span>
                          <span className="w-20">类型</span>
                          <span className="w-16">景别</span>
                          <span className="flex-1">画面描述</span>
                          <span className="w-8">时长</span>
                          <span className="w-16">情绪</span>
                          <span className="w-6"></span>
                        </div>
                        {epShots.map(shot => (
                          <ShotRow key={shot.id} shot={shot}
                            onUpdate={(data) => updateShot(shot.id, data)}
                            onRemove={() => removeShot(shot.id)} />
                        ))}
                      </>
                    )}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>

          {/* Reference tables */}
          <section>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"
              style={{ color: "oklch(0.75 0.17 65)", fontFamily: "'Space Grotesk', sans-serif" }}>
              <span className="px-2 py-0.5 rounded text-[10px]"
                style={{ background: "oklch(0.75 0.17 65 / 0.15)", border: "1px solid oklch(0.75 0.17 65 / 0.3)" }}>参考</span>
              镜头配比速查
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: "1px solid oklch(0.28 0.008 240)" }}>
                    {["场景类型", "定场", "Action", "Reaction", "逻辑", "旁跳", "总镜头"].map(h => (
                      <th key={h} className="text-left py-2 px-3 font-semibold"
                        style={{ color: "oklch(0.75 0.17 65)", fontFamily: "'Space Grotesk', sans-serif" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SHOT_RATIOS.map((r, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid oklch(0.22 0.006 240)" }}>
                      {[r.scene, r.establishing, r.action, r.reaction, r.logic, r.cutaway, r.total].map((v, j) => (
                        <td key={j} className="py-2 px-3"
                          style={{ color: j === 0 ? "oklch(0.85 0.005 60)" : j === 6 ? "oklch(0.75 0.17 65)" : "oklch(0.65 0.01 240)" }}>{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <div className="flex justify-end pt-2">
        <Button onClick={handleComplete} className="flex items-center gap-2 px-6"
          style={{ background: "oklch(0.75 0.17 65)", color: "oklch(0.1 0.005 240)", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600 }}>
          <CheckCircle2 className="w-4 h-4" />
          完成本阶段，进入提示词撰写
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
    </div>
  );
}
