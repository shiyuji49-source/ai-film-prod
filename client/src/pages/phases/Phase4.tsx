// DESIGN: "导演手册" 工业风暗色系 — Phase 4: Seedance Prompt Generation (v3 - Claude AI)
import { useProject } from "@/contexts/ProjectContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, ChevronRight, Wand2, Plus, Trash2, Copy, Check, Loader2, AlertCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { AIEstimateHint } from "@/components/AIEstimateHint";
import { GEMINI_ESTIMATE_SECS } from "@shared/const";

function CopyButton({ text, label = "复制" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("已复制");
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={handleCopy}
      className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-all"
      style={{
        background: copied ? "oklch(0.65 0.2 145 / 0.15)" : "oklch(0.22 0.006 240)",
        border: `1px solid ${copied ? "oklch(0.65 0.2 145 / 0.4)" : "oklch(0.28 0.008 240)"}`,
        color: copied ? "oklch(0.65 0.2 145)" : "oklch(0.60 0.01 240)",
        fontFamily: "'JetBrains Mono', monospace"
      }}>
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? "已复制" : label}
    </button>
  );
}

export default function Phase4() {
  const {
    projectInfo, scriptAnalysis, shots, videoSegments,
    addVideoSegment, updateVideoSegment, removeVideoSegment,
    autoGenerateSegments,
    markPhaseComplete, setActivePhase
  } = useProject();

  const [activeEpTab, setActiveEpTab] = useState(
    scriptAnalysis.episodes.length > 0 ? scriptAnalysis.episodes[0].id : ""
  );
  const [generatingSegId, setGeneratingSegId] = useState<string | null>(null);
  const [generatingAllEpId, setGeneratingAllEpId] = useState<string | null>(null);

  const episodes = scriptAnalysis.episodes;

  // 获取当前项目风格
  const styleZh = projectInfo.styleZh || "3D科幻机甲国漫风格";
  const styleEn = projectInfo.styleEn || "3D sci-fi mecha Chinese animation style, 4K ultra HD";
  const styleLabel = projectInfo.styleCategory ? `${projectInfo.styleCategory}${projectInfo.styleSubtype ? " · " + projectInfo.styleSubtype : ""}` : "";

  const generateVideoPromptMutation = trpc.ai.generateVideoPrompt.useMutation();
  const phase4Utils = trpc.useUtils();

  const handleAutoGenerateSegments = (episodeId: string) => {
    const epShots = shots.filter(s => s.episodeId === episodeId);
    if (epShots.length === 0) {
      toast.error("请先在阶段三生成分镜");
      return;
    }
    autoGenerateSegments(episodeId);
    toast.success("已自动生成视频片段分组");
  };

  const handleGeneratePrompt = async (segId: string) => {
    const seg = videoSegments.find(s => s.id === segId);
    if (!seg) return;

    const relatedShots = seg.shotIds
      .map(id => shots.find(s => s.id === id))
      .filter(Boolean) as typeof shots;

    if (relatedShots.length === 0) {
      toast.error("此片段没有关联的分镜");
      return;
    }

    const ep = episodes.find(e => e.id === seg.episodeId);

    setGeneratingSegId(segId);
    try {
      const result = await generateVideoPromptMutation.mutateAsync({
          shots: relatedShots.map(s => ({
          number: s.number,
          type: s.type,
          size: s.size,
          movement: s.movement,
          description: s.description,
          vo: s.vo || "",
          dialogue: s.dialogue || "",
          sfx: s.sfx || "",
          duration: s.duration,
          emotion: s.emotion,
          emotionLevel: s.emotionLevel,
        })),
        totalDuration: seg.duration,
        styleZh,
        styleEn,
        orientation: (projectInfo.orientation as "landscape" | "portrait" | undefined),
        market: projectInfo.market || undefined,
        episodeContext: ep ? `第${ep.number}集《${ep.title}》：${ep.synopsis}` : "",
      });
      updateVideoSegment(segId, { prompt: result.prompt });
      toast.success("提示词生成完成");
      // 刷新积分余额
      phase4Utils.auth.me.invalidate();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "未知错误";
      if (errMsg.includes("积分不足")) {
        toast.error(errMsg);
      } else {
        toast.error("生成失败，请重试");
        console.error(err);
      }
    } finally {
      setGeneratingSegId(null);
    }
  };

  const handleGenerateAllPrompts = async (episodeId: string) => {
    const epSegs = videoSegments.filter(s => s.episodeId === episodeId);
    if (epSegs.length === 0) {
      toast.error("请先生成视频片段分组");
      return;
    }

    setGeneratingAllEpId(episodeId);
    let successCount = 0;
    for (const seg of epSegs) {
      const relatedShots = seg.shotIds
        .map(id => shots.find(s => s.id === id))
        .filter(Boolean) as typeof shots;
      if (relatedShots.length === 0) continue;

      const ep = episodes.find(e => e.id === seg.episodeId);
      try {
        const result = await generateVideoPromptMutation.mutateAsync({
          shots: relatedShots.map(s => ({
            number: s.number,
            type: s.type,
            size: s.size,
            movement: s.movement,
            description: s.description,
            vo: s.vo || "",
            dialogue: s.dialogue || "",
            sfx: s.sfx || "",
            duration: s.duration,
            emotion: s.emotion,
            emotionLevel: s.emotionLevel,
          })),
          totalDuration: seg.duration,
          styleZh,
          styleEn,
          orientation: (projectInfo.orientation as "landscape" | "portrait" | undefined),
          market: projectInfo.market || undefined,
          episodeContext: ep ? `第${ep.number}集《${ep.title}》：${ep.synopsis}` : "",
        });
        updateVideoSegment(seg.id, { prompt: result.prompt });
        successCount++;
      } catch (err) {
        const errMsg2 = err instanceof Error ? err.message : "";
        if (errMsg2.includes("积分不足")) {
          toast.error(errMsg2);
          break; // 积分不足时停止批量生成
        }
        console.error(`片段 ${seg.name} 生成失败`, err);
      }
    }
    setGeneratingAllEpId(null);
    if (successCount > 0) phase4Utils.auth.me.invalidate();
    toast.success(`已生成 ${successCount}/${epSegs.length} 个片段提示词`);
  };

  const handleCopyAll = (episodeId: string) => {
    const epSegs = videoSegments.filter(s => s.episodeId === episodeId);
    const allPrompts = epSegs
      .filter(seg => seg.prompt)
      .map((seg, idx) => `=== 片段 ${idx + 1}：${seg.name} ===\n${seg.prompt}`)
      .join("\n\n");
    if (!allPrompts) {
      toast.error("没有可复制的提示词，请先生成");
      return;
    }
    navigator.clipboard.writeText(allPrompts);
    toast.success("已复制全集所有提示词");
  };

  return (
    <div className="space-y-8">
      {/* Phase header */}
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-12 h-12 rounded flex items-center justify-center text-lg font-bold"
          style={{ background: "oklch(0.75 0.17 65 / 0.15)", border: "1px solid oklch(0.75 0.17 65 / 0.4)", color: "oklch(0.75 0.17 65)", fontFamily: "'JetBrains Mono', monospace" }}>
          04
        </div>
        <div>
          <h2 className="text-xl font-bold" style={{ color: "oklch(0.92 0.005 60)", fontFamily: "'Space Grotesk', sans-serif" }}>
            提示词撰写
          </h2>
          <p className="text-sm mt-1" style={{ color: "oklch(0.55 0.01 240)" }}>
            AI 按分集自动生成 Seedance 多镜头中文视频提示词 · 含 VO / SFX · 无 @ 符号
          </p>
        </div>
      </div>

      {/* Seedance rules reminder */}
      <div className="p-4 rounded space-y-2"
        style={{ background: "oklch(0.75 0.17 65 / 0.06)", border: "1px solid oklch(0.75 0.17 65 / 0.2)" }}>
        <p className="text-xs font-semibold" style={{ color: "oklch(0.75 0.17 65)", fontFamily: "'Space Grotesk', sans-serif" }}>
          即梦 Seedance 1.5 Pro 全能参考模式 · 规则提醒
        </p>
        <div className="grid grid-cols-1 gap-1 text-xs" style={{ color: "oklch(0.65 0.01 240)" }}>
          <p>· 每段视频 10–15 秒，含 2–5 个镜头，一分钟需 20–30 个镜头（约 4–6 个片段）</p>
          <p>· 提示词全程中文，不出现 @ 符号（参考图自行在平台内添加）</p>
          <p>· 不引用具体作品名称，使用风格描述词代替</p>
          <p>· 旁白（VO）和音效（SFX）直接写入提示词，背景音乐除外</p>
        </div>
        {styleLabel && (
          <div className="mt-2 pt-2 border-t" style={{ borderColor: "oklch(0.75 0.17 65 / 0.2)" }}>
            <span className="text-xs" style={{ color: "oklch(0.55 0.01 240)" }}>当前风格：</span>
            <span className="text-xs ml-1" style={{ color: "oklch(0.75 0.17 65)" }}>{styleLabel}</span>
          </div>
        )}
      </div>

      {episodes.length === 0 ? (
        <div className="text-center py-12 rounded"
          style={{ border: "1px dashed oklch(0.28 0.008 240)", color: "oklch(0.45 0.008 240)" }}>
          <AlertCircle className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">请先在阶段一完成剧本解析</p>
        </div>
      ) : (
        <Tabs value={activeEpTab} onValueChange={setActiveEpTab}>
          <TabsList className="h-8 flex-wrap" style={{ background: "oklch(0.17 0.006 240)" }}>
            {episodes.map(ep => {
              const segCount = videoSegments.filter(s => s.episodeId === ep.id).length;
              const doneCount = videoSegments.filter(s => s.episodeId === ep.id && s.prompt).length;
              return (
                <TabsTrigger key={ep.id} value={ep.id} className="text-xs h-7 px-3"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  EP_{String(ep.number).padStart(2, "0")}
                  {segCount > 0 && (
                    <span className="ml-1 text-[9px] px-1 rounded"
                      style={{
                        background: doneCount === segCount ? "oklch(0.65 0.2 145 / 0.2)" : "oklch(0.75 0.17 65 / 0.2)",
                        color: doneCount === segCount ? "oklch(0.65 0.2 145)" : "oklch(0.75 0.17 65)"
                      }}>
                      {doneCount}/{segCount}
                    </span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {episodes.map(ep => {
            const epShots = shots.filter(s => s.episodeId === ep.id);
            const epSegs = videoSegments.filter(s => s.episodeId === ep.id);
            const totalDur = epSegs.reduce((a, s) => a + s.duration, 0);
            const isGeneratingAll = generatingAllEpId === ep.id;

            return (
              <TabsContent key={ep.id} value={ep.id} className="mt-4 space-y-4">
                {/* Episode toolbar */}
                <div className="flex items-center justify-between p-3 rounded flex-wrap gap-2"
                  style={{ background: "oklch(0.17 0.006 240)", border: "1px solid oklch(0.28 0.008 240)" }}>
                  <div>
                    <span className="text-sm font-semibold" style={{ color: "oklch(0.88 0.005 60)", fontFamily: "'Space Grotesk', sans-serif" }}>
                      {ep.title}
                    </span>
                    <span className="text-xs ml-3" style={{ color: "oklch(0.50 0.01 240)" }}>
                      {epShots.length} 个镜头 · {epSegs.length} 个片段 · 约 {totalDur}s
                    </span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button onClick={() => handleAutoGenerateSegments(ep.id)} size="sm" variant="outline"
                      className="flex items-center gap-1.5 text-xs h-7"
                      style={{ borderColor: "oklch(0.35 0.008 240)", color: "oklch(0.70 0.008 240)", background: "transparent" }}>
                      <Wand2 className="w-3 h-3" />
                      自动分组
                    </Button>
                    <Button
                      onClick={() => handleGenerateAllPrompts(ep.id)}
                      disabled={isGeneratingAll}
                      size="sm"
                      className="flex items-center gap-1.5 text-xs h-7"
                      style={{ background: "oklch(0.75 0.17 65)", color: "oklch(0.1 0.005 240)", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600 }}>
                      {isGeneratingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                      {isGeneratingAll ? "AI 生成中…" : "一键 AI 生成全部"}
                    </Button>
                    <AIEstimateHint isLoading={isGeneratingAll} min={GEMINI_ESTIMATE_SECS.generateVideoPrompt.min} max={GEMINI_ESTIMATE_SECS.generateVideoPrompt.max} />
                    {epSegs.length > 0 && (
                      <Button onClick={() => handleCopyAll(ep.id)} size="sm" variant="outline"
                        className="flex items-center gap-1.5 text-xs h-7"
                        style={{ borderColor: "oklch(0.35 0.008 240)", color: "oklch(0.70 0.008 240)", background: "transparent" }}>
                        <Copy className="w-3 h-3" />
                        复制全集
                      </Button>
                    )}
                    <Button onClick={() => addVideoSegment(ep.id)} size="sm" variant="outline"
                      className="flex items-center gap-1.5 text-xs h-7"
                      style={{ borderColor: "oklch(0.35 0.008 240)", color: "oklch(0.70 0.008 240)", background: "transparent" }}>
                      <Plus className="w-3 h-3" />
                      手动添加片段
                    </Button>
                  </div>
                </div>

                {isGeneratingAll && (
                  <div className="flex items-center gap-3 p-3 rounded text-xs"
                    style={{ background: "oklch(0.75 0.17 65 / 0.08)", border: "1px solid oklch(0.75 0.17 65 / 0.3)" }}>
                    <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" style={{ color: "oklch(0.75 0.17 65)" }} />
                    <span style={{ color: "oklch(0.75 0.17 65)" }}>
                      AI 正在逐片段生成 Seedance 中文提示词，请稍候…
                    </span>
                  </div>
                )}

                {epSegs.length === 0 ? (
                  <div className="text-center py-10 rounded"
                    style={{ border: "1px dashed oklch(0.28 0.008 240)", color: "oklch(0.45 0.008 240)" }}>
                    <p className="text-sm">
                      {epShots.length === 0
                        ? "请先在阶段三生成分镜，再回来自动生成提示词"
                        : "点击「自动分组」将分镜自动组合为 2–5 镜头的视频片段"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {epSegs.map((seg, idx) => {
                      const relatedShots = seg.shotIds.map(id => shots.find(s => s.id === id)).filter(Boolean);
                      const isGenerating = generatingSegId === seg.id;
                      return (
                        <div key={seg.id} className="rounded overflow-hidden"
                          style={{ border: `1px solid ${seg.prompt ? "oklch(0.65 0.2 145 / 0.3)" : "oklch(0.28 0.008 240)"}` }}>
                          {/* Segment header */}
                          <div className="flex items-center justify-between px-4 py-2.5"
                            style={{ background: "oklch(0.15 0.006 240)", borderBottom: "1px solid oklch(0.28 0.008 240)" }}>
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-bold"
                                style={{ color: "oklch(0.75 0.17 65)", fontFamily: "'JetBrains Mono', monospace" }}>
                                SEG_{String(idx + 1).padStart(2, "0")}
                              </span>
                              <Input value={seg.name}
                                onChange={e => updateVideoSegment(seg.id, { name: e.target.value })}
                                className="h-6 text-xs w-52"
                                style={{ background: "transparent", border: "none", color: "oklch(0.85 0.005 60)", padding: "0" }} />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] px-2 py-0.5 rounded"
                                style={{ background: "oklch(0.22 0.006 240)", color: "oklch(0.60 0.01 240)" }}>
                                {relatedShots.length} 镜头 · {seg.duration}s
                              </span>
                              {seg.prompt && (
                                <span className="text-[10px] px-2 py-0.5 rounded"
                                  style={{ background: "oklch(0.65 0.2 145 / 0.15)", color: "oklch(0.65 0.2 145)", border: "1px solid oklch(0.65 0.2 145 / 0.3)" }}>
                                  ✓ 已生成
                                </span>
                              )}
                              <Button
                                onClick={() => handleGeneratePrompt(seg.id)}
                                disabled={isGenerating || isGeneratingAll}
                                size="sm"
                                className="flex items-center gap-1 text-xs h-6"
                                style={{ background: "oklch(0.75 0.17 65)", color: "oklch(0.1 0.005 240)", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600 }}>
                                {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                                {isGenerating ? "生成中" : "AI 生成"}
                              </Button>
                              {seg.prompt && <CopyButton text={seg.prompt} />}
                              <button onClick={() => removeVideoSegment(seg.id)} className="p-1 rounded hover:bg-red-500/10">
                                <Trash2 className="w-3 h-3" style={{ color: "oklch(0.55 0.15 25)" }} />
                              </button>
                            </div>
                          </div>

                          <div className="p-3 space-y-2">
                            {/* Shot tags */}
                            {relatedShots.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {relatedShots.map(shot => shot && (
                                  <span key={shot.id} className="text-[10px] px-2 py-0.5 rounded"
                                    style={{ background: "oklch(0.22 0.006 240)", color: "oklch(0.65 0.01 240)", border: "1px solid oklch(0.28 0.008 240)" }}>
                                    镜{shot.number} · {shot.size} · {shot.movement} · {shot.emotion}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Duration control */}
                            <div className="flex items-center gap-3">
                              <Label className="text-[10px] flex-shrink-0" style={{ color: "oklch(0.55 0.01 240)" }}>
                                片段时长(秒)
                              </Label>
                              <Input
                                type="number" min={5} max={15}
                                value={seg.duration ?? 10}
                                onChange={e => updateVideoSegment(seg.id, { duration: Number(e.target.value) })}
                                className="h-7 text-xs w-20"
                                style={{ background: "oklch(0.17 0.006 240)", border: "1px solid oklch(0.28 0.008 240)", color: "oklch(0.88 0.005 60)" }} />
                              <span className="text-[10px]" style={{ color: "oklch(0.45 0.008 240)" }}>建议 10–15 秒</span>
                            </div>

                            {/* Generated prompt */}
                            {seg.prompt ? (
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[10px] uppercase tracking-widest"
                                    style={{ color: "oklch(0.45 0.008 240)", fontFamily: "'JetBrains Mono', monospace" }}>
                                    Seedance 中文提示词
                                  </span>
                                  <CopyButton text={seg.prompt} />
                                </div>
                                <Textarea value={seg.prompt}
                                  onChange={e => updateVideoSegment(seg.id, { prompt: e.target.value })}
                                  rows={8} className="text-xs resize-none"
                                  style={{ background: "oklch(0.10 0.004 240)", border: "1px solid oklch(0.28 0.008 240)", color: "oklch(0.85 0.005 60)", fontFamily: "'JetBrains Mono', monospace", borderLeft: "3px solid oklch(0.75 0.17 65)", lineHeight: "1.7" }} />
                              </div>
                            ) : isGenerating ? (
                              <div className="flex items-center gap-2 py-6 justify-center text-xs rounded"
                                style={{ border: "1px dashed oklch(0.28 0.008 240)", color: "oklch(0.55 0.01 240)" }}>
                                <Loader2 className="w-4 h-4 animate-spin" style={{ color: "oklch(0.75 0.17 65)" }} />
                                AI 正在生成中文提示词…
                              </div>
                            ) : (
                              <div className="text-center py-4 rounded text-xs"
                                style={{ border: "1px dashed oklch(0.25 0.008 240)", color: "oklch(0.40 0.008 240)" }}>
                                点击「AI 生成」按钮，AI 将根据分镜内容生成 Seedance 中文提示词
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      )}

      <div className="flex justify-end pt-2">
        <Button onClick={() => { markPhaseComplete("phase4"); setActivePhase("phase5"); }}
          className="flex items-center gap-2 px-6"
          style={{ background: "oklch(0.75 0.17 65)", color: "oklch(0.1 0.005 240)", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700 }}>
          完成提示词撰写
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
