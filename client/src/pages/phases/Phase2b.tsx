// Phase2b: 场景资产（已从场景+道具拆分，道具移至 Phase2c）
// 工作流：① AI 生成 MJ7 提示词 → ② 上传 MJ 参考图 → ③ Nano 生成场景多视角 4 张图 → ④ 导入资产库
import { useProject } from "@/contexts/ProjectContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2, ChevronRight, Wand2, Copy, Check, Mountain,
  Loader2, Upload, ImageIcon, Download, Library, RefreshCw, Plus, Trash2, ChevronDown, ChevronUp
} from "lucide-react";
import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import type { EpisodeAsset } from "@/contexts/ProjectContext";
import { AIEstimateHint } from "@/components/AIEstimateHint";
import { GEMINI_ESTIMATE_SECS } from "@shared/const";

const S = {
  card: { background: "oklch(0.15 0.006 240)", border: "1px solid oklch(0.22 0.006 240)", borderRadius: "8px" } as React.CSSProperties,
  amber: "oklch(0.75 0.17 65)",
  green: "oklch(0.65 0.2 145)",
  blue: "oklch(0.60 0.18 240)",
  purple: "oklch(0.65 0.18 290)",
  teal: "oklch(0.65 0.15 185)",
  dim: "oklch(0.55 0.01 240)",
  text: "oklch(0.88 0.005 60)",
  sub: "oklch(0.70 0.008 240)",
  mono: "'JetBrains Mono', monospace" as const,
  grotesk: "'Space Grotesk', sans-serif" as const,
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); toast.success("已复制"); setTimeout(() => setCopied(false), 1500); }}
      className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-all"
      style={{ background: copied ? "oklch(0.65 0.2 145 / 0.15)" : "oklch(0.22 0.006 240)", border: `1px solid ${copied ? "oklch(0.65 0.2 145 / 0.4)" : "oklch(0.28 0.008 240)"}`, color: copied ? S.green : "oklch(0.60 0.01 240)", fontFamily: S.mono }}>
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? "已复制" : "复制"}
    </button>
  );
}

function ImageUploadZone({ imageUrl, onUpload, uploading }: { imageUrl?: string | null; onUpload: (b64: string, mime: string) => void; uploading: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleFile = useCallback((file: File) => {
    if (file.size > 16 * 1024 * 1024) { toast.error("图片大小不能超过 16MB"); return; }
    const reader = new FileReader();
    reader.onload = (e) => { const r = e.target?.result as string; const [h, b] = r.split(","); onUpload(b, h.match(/data:(.*);base64/)?.[1] ?? "image/jpeg"); };
    reader.readAsDataURL(file);
  }, [onUpload]);
  return (
    <div className="relative border-2 border-dashed rounded-lg overflow-hidden cursor-pointer transition-all"
      style={{ borderColor: imageUrl ? "oklch(0.45 0.12 185)" : "oklch(0.28 0.008 240)", background: "oklch(0.10 0.004 240)", minHeight: "120px" }}
      onClick={() => inputRef.current?.click()}
      onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type.startsWith("image/")) handleFile(f); }}
      onDragOver={(e) => e.preventDefault()}>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      {imageUrl ? (
        <div className="relative" style={{ minHeight: "120px" }}>
          <img src={imageUrl} alt="参考图" className="w-full object-contain" style={{ maxHeight: "180px" }} />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity" style={{ background: "oklch(0 0 0 / 0.6)" }}>
            <span className="text-xs" style={{ color: S.text }}>点击重新上传</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 p-4" style={{ minHeight: "120px" }}>
          {uploading ? <Loader2 className="w-5 h-5 animate-spin" style={{ color: S.teal }} /> : <><Upload className="w-5 h-5" style={{ color: "oklch(0.35 0.008 240)" }} /><p className="text-xs text-center" style={{ color: S.dim }}>点击或拖拽上传 MJ 参考图</p></>}
        </div>
      )}
    </div>
  );
}

function SceneAssetCard({ asset }: { asset: EpisodeAsset }) {
  const { projectInfo, updateEpisodeAsset, removeEpisodeAsset, scriptAnalysis } = useProject();
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();

  const [uploading, setUploading] = useState(false);
  const [generatingMJ, setGeneratingMJ] = useState(false);
  const [generatingViews, setGeneratingViews] = useState<Record<string, boolean>>({});
  const [importing, setImporting] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const generateMJMutation = trpc.ai.generateAssetPrompt.useMutation();
  const createAssetMutation = trpc.assets.create.useMutation();
  const uploadMutation = trpc.assets.uploadImage.useMutation();
  const generateMultiMutation = trpc.assets.generateMultiView.useMutation();

  const parsedPrompt = (() => { try { return asset.promptMJ ? JSON.parse(asset.promptMJ) as { zh: string; en: string } : null; } catch { return null; } })();

  const getOrCreateAssetId = async (): Promise<number> => {
    if (asset.assetLibId) return asset.assetLibId;
    const a = await createAssetMutation.mutateAsync({ type: "scene", name: asset.name || "未命名场景", description: asset.description || "", mjPrompt: parsedPrompt?.en, mainPrompt: asset.nanoPrompt || undefined });
    updateEpisodeAsset(asset.id, { assetLibId: a.id });
    return a.id;
  };

  const handleGenerateMJ = async () => {
    setGeneratingMJ(true);
    try {
      const ep = scriptAnalysis?.episodes?.find(e => e.id === asset.episodeId);
      const result = await generateMJMutation.mutateAsync({ type: "scene", name: asset.name || "场景", description: asset.description || asset.name || "场景", episodeContext: ep ? `第${ep.number}集《${ep.title}》：${ep.synopsis}` : undefined, styleZh: projectInfo.styleZh, styleEn: projectInfo.styleEn });
      updateEpisodeAsset(asset.id, { promptMJ: JSON.stringify(result) });
      toast.success(`${asset.name || "场景"} MJ7 提示词已生成`);
    } catch (err) { toast.error(`生成失败：${err instanceof Error ? err.message : "未知错误"}`); }
    finally { setGeneratingMJ(false); }
  };

  const handleUpload = async (base64: string, mimeType: string) => {
    if (!isAuthenticated) { toast.error("请先登录后再上传图片"); return; }
    setUploading(true);
    try {
      const assetId = await getOrCreateAssetId();
      const result = await uploadMutation.mutateAsync({ id: assetId, imageBase64: base64, mimeType });
      updateEpisodeAsset(asset.id, { uploadedImageUrl: result.uploadedImageUrl });
      utils.assets.list.invalidate();
      toast.success("参考图已上传，请点击各视角按鈕开始生成");
    } catch (err) { toast.error(`上传失败：${err instanceof Error ? err.message : "未知错误"}`); }
    finally { setUploading(false); }
  };

  const VIEW_TYPES: { viewType: "front" | "angle1" | "angle2" | "angle3"; label: string; key: keyof EpisodeAsset }[] = [
    { viewType: "front", label: "正面全景", key: "mainImageUrl" },
    { viewType: "angle1", label: "3/4视角", key: "angle1ImageUrl" },
    { viewType: "angle2", label: "俯视角", key: "angle2ImageUrl" },
    { viewType: "angle3", label: "仰视角", key: "angle3ImageUrl" },
  ];

  const handleGenerateView = async (viewType: "front" | "angle1" | "angle2" | "angle3", key: keyof EpisodeAsset, uploadedUrl?: string) => {
    const imageUrl = uploadedUrl || asset.uploadedImageUrl;
    if (!imageUrl) { toast.error("请先上传 MJ 参考图"); return; }
    if (!isAuthenticated) { toast.error("请先登录后再生成图片"); return; }
    setGeneratingViews(p => ({ ...p, [viewType]: true }));
    try {
      const assetId = await getOrCreateAssetId();
      const result = await generateMultiMutation.mutateAsync({ id: assetId, viewType, prompt: asset.nanoPrompt || undefined });
      updateEpisodeAsset(asset.id, { [key]: result.imageUrl });
      utils.assets.list.invalidate();
      toast.success(`${VIEW_TYPES.find(v => v.viewType === viewType)?.label} 生成完成`);
    } catch (err) { toast.error(`生成失败：${err instanceof Error ? err.message : "未知错误"}`); }
    finally { setGeneratingViews(p => ({ ...p, [viewType]: false })); }
  };

  const handleImport = async () => {
    if (!isAuthenticated) { toast.error("请先登录后再导入资产库"); return; }
    setImporting(true);
    try { const assetId = await getOrCreateAssetId(); utils.assets.list.invalidate(); toast.success(`${asset.name || "场景"} 已导入资产库（ID: ${assetId}）`); }
    catch (err) { toast.error(`导入失败：${err instanceof Error ? err.message : "未知错误"}`); }
    finally { setImporting(false); }
  };

  return (
    <div className="p-4 space-y-4" style={S.card}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Mountain className="w-4 h-4 flex-shrink-0" style={{ color: S.teal }} />
          <input value={asset.name} onChange={e => updateEpisodeAsset(asset.id, { name: e.target.value })} placeholder="场景名称" className="bg-transparent text-sm font-bold border-none outline-none flex-1 min-w-0" style={{ color: S.text, fontFamily: S.grotesk }} />
          {asset.assetLibId && <Badge className="text-xs px-1.5 py-0 flex-shrink-0" style={{ background: "oklch(0.65 0.2 145 / 0.15)", border: "1px solid oklch(0.65 0.2 145 / 0.4)", color: S.green }}><CheckCircle2 className="w-2.5 h-2.5 mr-1" />已入库</Badge>}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Button size="sm" onClick={handleImport} disabled={importing} style={{ background: "oklch(0.65 0.2 145 / 0.12)", border: "1px solid oklch(0.65 0.2 145 / 0.35)", color: S.green }}>
            {importing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Library className="w-3 h-3" />}
          </Button>
          <button onClick={() => setCollapsed(c => !c)} className="p-1.5 rounded" style={{ color: S.dim }}>{collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}</button>
          <button onClick={() => removeEpisodeAsset(asset.id)} className="p-1.5 rounded" style={{ color: "oklch(0.55 0.15 25)" }}><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {!collapsed && (
        <>
          <input value={asset.description} onChange={e => updateEpisodeAsset(asset.id, { description: e.target.value })} placeholder="场景描述（如：废弃工厂，夜晚，霓虹灯光）" className="w-full bg-transparent text-xs border-b outline-none pb-1" style={{ color: S.sub, borderColor: "oklch(0.22 0.006 240)", fontFamily: S.mono }} />

          {/* STEP 1: MJ7 提示词 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: "oklch(0.75 0.17 65 / 0.15)", border: "1px solid oklch(0.75 0.17 65 / 0.3)", color: S.amber, fontFamily: S.mono }}>STEP 1</span>
                <span className="text-xs font-semibold" style={{ color: S.amber }}>MJ7 提示词</span>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleGenerateMJ} disabled={generatingMJ} style={{ background: "oklch(0.75 0.17 65 / 0.12)", border: "1px solid oklch(0.75 0.17 65 / 0.35)", color: S.amber }}>
                  {generatingMJ ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />生成中</> : <><Wand2 className="w-3 h-3 mr-1" />{parsedPrompt ? "重新生成" : "AI 生成"}</>}
                </Button>
                <AIEstimateHint isLoading={generatingMJ} min={GEMINI_ESTIMATE_SECS.generateAsset.min} max={GEMINI_ESTIMATE_SECS.generateAsset.max} />
              </div>
            </div>
            {parsedPrompt ? (
              <div className="space-y-1.5">
                <div className="p-2.5 rounded text-xs" style={{ background: "oklch(0.10 0.004 240)", border: "1px solid oklch(0.22 0.006 240)", color: "oklch(0.75 0.008 240)", fontFamily: S.mono }}>
                  <div className="flex items-start justify-between gap-2 mb-1"><span style={{ color: S.dim }}>ZH</span><CopyButton text={parsedPrompt.zh} /></div>
                  <div className="whitespace-pre-wrap">{parsedPrompt.zh}</div>
                </div>
                <div className="p-2.5 rounded text-xs" style={{ background: "oklch(0.10 0.004 240)", border: "1px solid oklch(0.22 0.006 240)", color: "oklch(0.70 0.008 240)", fontFamily: S.mono }}>
                  <div className="flex items-start justify-between gap-2 mb-1"><span style={{ color: S.dim }}>EN</span><CopyButton text={parsedPrompt.en} /></div>
                  <div className="whitespace-pre-wrap">{parsedPrompt.en}</div>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded text-xs text-center" style={{ background: "oklch(0.10 0.004 240)", border: "1px dashed oklch(0.28 0.008 240)", color: S.dim }}>点击「AI 生成」，AI 将基于场景信息生成专属 MJ7 提示词</div>
            )}
          </div>

          {/* STEP 2: 上传 MJ 参考图 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: "oklch(0.55 0.18 290 / 0.15)", border: "1px solid oklch(0.55 0.18 290 / 0.3)", color: S.purple, fontFamily: S.mono }}>STEP 2</span>
              <span className="text-xs font-semibold" style={{ color: S.purple }}>上传 MJ 参考图（上传后一键生成）</span>
            </div>
            <div>
              <p className="text-[10px] mb-1.5" style={{ color: S.dim }}>MJ 参考图（用 MJ7 生成后上传，提示词已预设）</p>
              <ImageUploadZone imageUrl={asset.uploadedImageUrl} onUpload={handleUpload} uploading={uploading} />
            </div>
          </div>

          {/* STEP 3: 生成多视角 4 张图 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: "oklch(0.60 0.18 240 / 0.15)", border: "1px solid oklch(0.60 0.18 240 / 0.3)", color: S.blue, fontFamily: S.mono }}>STEP 3</span>
              <span className="text-xs font-semibold" style={{ color: S.blue }}>Gemini 生成场景多视角图（4张）</span>
              {!asset.uploadedImageUrl && <span className="text-[10px]" style={{ color: S.dim }}>请先上传参考图</span>}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {VIEW_TYPES.map(({ viewType, label, key }) => {
                const url = asset[key] as string | undefined;
                const isGenerating = !!generatingViews[viewType];
                return (
                  <div key={viewType} className="space-y-1">
                    <div className="rounded overflow-hidden" style={{ background: "oklch(0.10 0.004 240)", border: "1px solid oklch(0.22 0.006 240)", aspectRatio: "16/9" }}>
                      {url ? <img src={url} alt={label} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-4 h-4" style={{ color: "oklch(0.30 0.006 240)" }} /></div>}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px]" style={{ color: S.dim }}>{label}</span>
                      <div className="flex items-center gap-1">
                        {url && <a href={url} download target="_blank" rel="noreferrer" className="hover:opacity-80" style={{ color: "oklch(0.45 0.01 240)" }}><Download className="w-3 h-3" /></a>}
                        <button onClick={() => handleGenerateView(viewType, key)} disabled={isGenerating || !asset.uploadedImageUrl} className="p-0.5 rounded disabled:opacity-40 transition-all" style={{ color: url ? S.purple : S.blue }}>
                          {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : url ? <RefreshCw className="w-3 h-3" /> : <Wand2 className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function EpisodeSection({ episodeId, episodeTitle }: { episodeId: string; episodeTitle: string }) {
  const { episodeAssets, addEpisodeAsset } = useProject();
  const [collapsed, setCollapsed] = useState(false);
  const scenes = episodeAssets.filter(a => a.episodeId === episodeId && a.type === "scene");
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between p-3 rounded cursor-pointer" style={{ background: "oklch(0.13 0.005 240)", border: "1px solid oklch(0.20 0.006 240)" }} onClick={() => setCollapsed(c => !c)}>
        <div className="flex items-center gap-3">
          <Mountain className="w-4 h-4" style={{ color: S.teal }} />
          <span className="font-semibold text-sm" style={{ color: S.text, fontFamily: S.grotesk }}>{episodeTitle}</span>
          <span className="text-xs px-2 py-0.5 rounded" style={{ background: "oklch(0.65 0.15 185 / 0.15)", border: "1px solid oklch(0.65 0.15 185 / 0.3)", color: S.teal, fontFamily: S.mono }}>{scenes.length} 场景</span>
        </div>
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          <Button size="sm" onClick={() => addEpisodeAsset(episodeId, "scene")} style={{ background: "oklch(0.65 0.15 185 / 0.12)", border: "1px solid oklch(0.65 0.15 185 / 0.35)", color: S.teal }}><Plus className="w-3 h-3 mr-1" />添加场景</Button>
          <button onClick={() => setCollapsed(c => !c)} style={{ color: S.dim }}>{collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}</button>
        </div>
      </div>
      {!collapsed && (
        <div className="space-y-3 pl-4">
          {scenes.length === 0 ? <div className="p-4 text-center rounded" style={{ background: "oklch(0.12 0.005 240)", border: "1px dashed oklch(0.22 0.006 240)" }}><p className="text-xs" style={{ color: S.dim }}>暂无场景，点击「添加场景」开始</p></div> : scenes.map(asset => <SceneAssetCard key={asset.id} asset={asset} />)}
        </div>
      )}
    </div>
  );
}

export default function Phase2b() {
  const { scriptAnalysis, episodeAssets, markPhaseComplete, setActivePhase } = useProject();
  const episodes = scriptAnalysis?.episodes ?? [];
  const totalScenes = episodeAssets.filter(a => a.type === "scene").length;

  return (
    <div className="space-y-8">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-12 h-12 rounded flex items-center justify-center text-lg font-bold" style={{ background: "oklch(0.65 0.15 185 / 0.15)", border: "1px solid oklch(0.65 0.15 185 / 0.4)", color: S.teal, fontFamily: S.mono }}>2B</div>
        <div>
          <h2 className="text-xl font-bold mb-1" style={{ color: S.text, fontFamily: S.grotesk }}>场景资产</h2>
          <p className="text-sm" style={{ color: S.sub }}>MJ7 提示词 → 上传参考图 → Gemini 3 Pro Image 生成场景多视角 4 张图 → 导入资产库</p>
        </div>
      </div>

      <div className="p-4 rounded" style={{ background: "oklch(0.13 0.005 240)", border: "1px solid oklch(0.20 0.006 240)" }}>
        <div className="flex flex-wrap gap-4 text-xs" style={{ color: S.dim }}>
          <div className="flex items-center gap-1.5"><span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: "oklch(0.75 0.17 65 / 0.15)", color: S.amber, fontFamily: S.mono }}>STEP 1</span>AI 生成 MJ7 提示词 → 复制到 Midjourney</div>
          <span style={{ color: "oklch(0.30 0.006 240)" }}>→</span>
          <div className="flex items-center gap-1.5"><span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: "oklch(0.55 0.18 290 / 0.15)", color: S.purple, fontFamily: S.mono }}>STEP 2</span>上传 MJ 参考图 + Nano 辅助提示词</div>
          <span style={{ color: "oklch(0.30 0.006 240)" }}>→</span>
          <div className="flex items-center gap-1.5"><span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: "oklch(0.60 0.18 240 / 0.15)", color: S.blue, fontFamily: S.mono }}>STEP 3</span>Nano 生成正面全景 / 3/4视角 / 俯视 / 仰视</div>
          <span style={{ color: "oklch(0.30 0.006 240)" }}>→</span>
          <div className="flex items-center gap-1.5"><Library className="w-3 h-3" style={{ color: S.green }} />导入资产库</div>
        </div>
      </div>

      {totalScenes > 0 && <div className="flex items-center gap-2 text-xs" style={{ color: S.dim }}><Mountain className="w-3.5 h-3.5" style={{ color: S.teal }} />共 {totalScenes} 个场景资产</div>}

      {episodes.length === 0 ? (
        <div className="p-8 text-center rounded" style={S.card}><p className="text-sm" style={{ color: S.dim }}>请先在阶段一完成剧本解析，系统将自动提取分集信息</p></div>
      ) : (
        <div className="space-y-6">{episodes.map(ep => <EpisodeSection key={ep.id} episodeId={ep.id} episodeTitle={ep.title || `第 ${ep.number} 集`} />)}</div>
      )}

      <div className="flex justify-end pt-4 border-t" style={{ borderColor: "oklch(0.22 0.006 240)" }}>
        <Button onClick={() => { markPhaseComplete("phase2b"); setActivePhase("phase2c"); }} className="gap-2" style={{ background: "oklch(0.65 0.15 185)", color: "oklch(0.10 0.005 240)", fontWeight: 700 }}>
          场景资产完成，进入道具资产<ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
