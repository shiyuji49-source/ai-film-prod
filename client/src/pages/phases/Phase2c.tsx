// Phase2c: 道具资产（独立页面）
// 工作流：① AI 生成 MJ7 提示词 → ② 上传 MJ 参考图 → ③ Nano 生成一张三视图 → ④ 导入资产库
import { useProject } from "@/contexts/ProjectContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2, ChevronRight, Wand2, Copy, Check, Package,
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
  orange: "oklch(0.70 0.18 55)",
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
      style={{ borderColor: imageUrl ? "oklch(0.45 0.12 55)" : "oklch(0.28 0.008 240)", background: "oklch(0.10 0.004 240)", minHeight: "120px" }}
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
          {uploading ? <Loader2 className="w-5 h-5 animate-spin" style={{ color: S.orange }} /> : <><Upload className="w-5 h-5" style={{ color: "oklch(0.35 0.008 240)" }} /><p className="text-xs text-center" style={{ color: S.dim }}>点击或拖拽上传 MJ 参考图</p></>}
        </div>
      )}
    </div>
  );
}

function PropAssetCard({ asset }: { asset: EpisodeAsset }) {
  const { projectInfo, updateEpisodeAsset, removeEpisodeAsset, scriptAnalysis } = useProject();
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();

  const [uploading, setUploading] = useState(false);
  const [generatingMJ, setGeneratingMJ] = useState(false);
  const [generatingTriview, setGeneratingTriview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const generateMJMutation = trpc.ai.generateAssetPrompt.useMutation();
  const createAssetMutation = trpc.assets.create.useMutation();
  const uploadMutation = trpc.assets.uploadImage.useMutation();
  const generateMultiMutation = trpc.assets.generateMultiView.useMutation();

  const parsedPrompt = (() => { try { return asset.promptMJ ? JSON.parse(asset.promptMJ) as { zh: string; en: string } : null; } catch { return null; } })();

  const getOrCreateAssetId = async (): Promise<number> => {
    if (asset.assetLibId) return asset.assetLibId;
    const a = await createAssetMutation.mutateAsync({ type: "prop", name: asset.name || "未命名道具", description: asset.description || "", mjPrompt: parsedPrompt?.en, mainPrompt: asset.nanoPrompt || undefined });
    updateEpisodeAsset(asset.id, { assetLibId: a.id });
    return a.id;
  };

  const handleGenerateMJ = async () => {
    setGeneratingMJ(true);
    try {
      const ep = scriptAnalysis?.episodes?.find(e => e.id === asset.episodeId);
      const result = await generateMJMutation.mutateAsync({ type: "prop", name: asset.name || "道具", description: asset.description || asset.name || "道具", episodeContext: ep ? `第${ep.number}集《${ep.title}》：${ep.synopsis}` : undefined, styleZh: projectInfo.styleZh, styleEn: projectInfo.styleEn });
      updateEpisodeAsset(asset.id, { promptMJ: JSON.stringify(result) });
      toast.success(`${asset.name || "道具"} MJ7 提示词已生成`);
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
      toast.success("参考图已上传，请点击「生成三视图」按鈕开始生成");
    } catch (err) { toast.error(`上传失败：${err instanceof Error ? err.message : "未知错误"}`); }
    finally { setUploading(false); }
  };

  // 根据道具名称推断类型，生成对应的 Gemini 三视图提示词
  const getTriviewPrompt = (name: string, customPrompt?: string): string => {
    const n = name.toLowerCase();
    let basePrompt = "product three-view design sheet, front view left, side view center, back view right, clean white background, studio lighting, no shadows, technical illustration style";
    // 武器类
    if (/剑|刀|枪|弓|战斧|武器|弹|炮|sword|blade|gun|bow|weapon|axe|spear/.test(n)) {
      basePrompt = "weapon three-view design sheet, front view left, side view center, back view right, detailed metallic texture, clean white background, studio lighting, technical blueprint style, no shadows";
    }
    // 载具/交通工具类
    else if (/车|船|飞机|機器|车辆|飞船|小船|car|vehicle|ship|aircraft|mech|robot/.test(n)) {
      basePrompt = "vehicle three-view design sheet, front view left, side view center, back view right, mechanical details, clean white background, studio lighting, technical blueprint style, no shadows";
    }
    // 道具/工具类
    else if (/道具|工具|锄|锥|阆|锂|tool|hammer|wrench|drill/.test(n)) {
      basePrompt = "tool three-view design sheet, front view left, side view center, back view right, material texture details, clean white background, studio lighting, technical illustration style, no shadows";
    }
    // 容器/道具类
    else if (/瓶|盒|笛|杆|包|袋|鼎|bottle|box|bag|container|vessel/.test(n)) {
      basePrompt = "container three-view design sheet, front view left, side view center, back view right, material and texture details, clean white background, studio lighting, no shadows";
    }
    // 界面/UI/显示类
    else if (/面板|屏幕|界面|显示器|控制台|全息|头盔|数据|导航|监控|panel|screen|interface|display|hud|holographic|console|monitor/.test(n)) {
      basePrompt = "holographic UI panel design sheet, front view center, dark background, glowing interface elements, neon blue and cyan color scheme, sci-fi HUD style, clean layout with data readouts, no physical frame, floating display effect";
    }
    if (customPrompt) return `${basePrompt}, ${customPrompt}`;
    return basePrompt;
  };

  // 道具只生成一张三视图（front/side/back 合并在一张图里，用 front 视角触发）
  const handleGenerateTriview = async (uploadedUrl?: string) => {
    const imageUrl = uploadedUrl || asset.uploadedImageUrl;
    if (!imageUrl) { toast.error("请先上传 MJ 参考图"); return; }
    if (!isAuthenticated) { toast.error("请先登录后再生成图片"); return; }
    setGeneratingTriview(true);
    try {
      const assetId = await getOrCreateAssetId();
      // 根据道具类型自动选择提示词
      const triviewPrompt = getTriviewPrompt(asset.name || "", asset.nanoPrompt || undefined);
      const result = await generateMultiMutation.mutateAsync({ id: assetId, viewType: "front", prompt: triviewPrompt });
      updateEpisodeAsset(asset.id, { mainImageUrl: result.imageUrl });
      utils.assets.list.invalidate();
      toast.success("三视图生成完成！");
    } catch (err) { toast.error(`生成失败：${err instanceof Error ? err.message : "未知错误"}`); }
    finally { setGeneratingTriview(false); }
  };

  const handleImport = async () => {
    if (!isAuthenticated) { toast.error("请先登录后再导入资产库"); return; }
    setImporting(true);
    try { const assetId = await getOrCreateAssetId(); utils.assets.list.invalidate(); toast.success(`${asset.name || "道具"} 已导入资产库（ID: ${assetId}）`); }
    catch (err) { toast.error(`导入失败：${err instanceof Error ? err.message : "未知错误"}`); }
    finally { setImporting(false); }
  };

  return (
    <div className="p-4 space-y-4" style={S.card}>
      {/* 标题行 */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Package className="w-4 h-4 flex-shrink-0" style={{ color: S.orange }} />
          <input value={asset.name} onChange={e => updateEpisodeAsset(asset.id, { name: e.target.value })} placeholder="道具名称" className="bg-transparent text-sm font-bold border-none outline-none flex-1 min-w-0" style={{ color: S.text, fontFamily: S.grotesk }} />
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
          <input value={asset.description} onChange={e => updateEpisodeAsset(asset.id, { description: e.target.value })} placeholder="道具描述（如：未来科技感激光剑，蓝色光刃）" className="w-full bg-transparent text-xs border-b outline-none pb-1" style={{ color: S.sub, borderColor: "oklch(0.22 0.006 240)", fontFamily: S.mono }} />

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
              <div className="p-3 rounded text-xs text-center" style={{ background: "oklch(0.10 0.004 240)", border: "1px dashed oklch(0.28 0.008 240)", color: S.dim }}>点击「AI 生成」，AI 将基于道具信息生成专属 MJ7 提示词</div>
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
            {/* Nano 辅助提示词（可选，追加到自动生成的基础提示词后面） */}
            <div className="space-y-1 mt-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px]" style={{ color: S.dim }}>
                  Gemini 辅助提示词（可选）——追加到自动提示词末尾
                </p>
                <button
                  className="text-[10px] px-1.5 py-0.5 rounded transition-opacity hover:opacity-80"
                  style={{ color: S.dim, background: "oklch(0.15 0.005 240)", border: "1px solid oklch(0.22 0.006 240)" }}
                  onClick={() => {
                    const preview = getTriviewPrompt(asset.name || "", asset.nanoPrompt || undefined);
                    toast.info(`Gemini 提示词预览：${preview}`, { duration: 8000 });
                  }}
                >
                  预览完整提示词
                </button>
              </div>
              <Textarea
                value={asset.nanoPrompt || ""}
                onChange={e => updateEpisodeAsset(asset.id, { nanoPrompt: e.target.value })}
                placeholder="可选：输入额外要求，如 golden metallic surface, glowing runes，将自动追加到 Gemini 提示词末尾"
                rows={2}
                className="text-xs resize-none"
                style={{ background: "oklch(0.10 0.004 240)", border: "1px solid oklch(0.22 0.006 240)", color: S.sub, fontFamily: S.mono }}
              />
            </div>
          </div>

          {/* STEP 3: 生成三视图（一张图包含正/侧/背） */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: "oklch(0.60 0.18 240 / 0.15)", border: "1px solid oklch(0.60 0.18 240 / 0.3)", color: S.blue, fontFamily: S.mono }}>STEP 3</span>
                <span className="text-xs font-semibold" style={{ color: S.blue }}>Gemini 生成三视图（正面 / 侧面 / 背面）</span>
                {!asset.uploadedImageUrl && <span className="text-[10px]" style={{ color: S.dim }}>请先上传参考图</span>}
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => handleGenerateTriview()} disabled={generatingTriview || !asset.uploadedImageUrl}
                  style={{ background: asset.mainImageUrl ? "oklch(0.55 0.18 290 / 0.12)" : "oklch(0.60 0.18 240 / 0.12)", border: `1px solid ${asset.mainImageUrl ? "oklch(0.55 0.18 290 / 0.4)" : "oklch(0.60 0.18 240 / 0.35)"}`, color: asset.mainImageUrl ? S.purple : S.blue }}>
                  {generatingTriview ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />生成中</> : asset.mainImageUrl ? <><RefreshCw className="w-3 h-3 mr-1" />重新生成</> : <><Wand2 className="w-3 h-3 mr-1" />生成三视图</>}
                </Button>
                <AIEstimateHint isLoading={generatingTriview} min={GEMINI_ESTIMATE_SECS.generateAsset.min} max={GEMINI_ESTIMATE_SECS.generateAsset.max} />
              </div>
            </div>
            {asset.mainImageUrl ? (
              <div className="rounded overflow-hidden" style={{ background: "oklch(0.10 0.004 240)", border: "1px solid oklch(0.22 0.006 240)" }}>
                <img src={asset.mainImageUrl} alt="三视图" className="w-full object-contain" style={{ maxHeight: "280px" }} />
                <div className="flex items-center justify-between px-3 py-2" style={{ borderTop: "1px solid oklch(0.20 0.006 240)" }}>
                  <span className="text-[10px]" style={{ color: S.dim }}>道具三视图（正面 / 侧面 / 背面）</span>
                  <a href={asset.mainImageUrl} download target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10px] hover:opacity-80" style={{ color: "oklch(0.55 0.01 240)" }}>
                    <Download className="w-3 h-3" />下载
                  </a>
                </div>
              </div>
            ) : (
              <div className="p-6 rounded text-center" style={{ background: "oklch(0.10 0.004 240)", border: "1px dashed oklch(0.28 0.008 240)" }}>
                <ImageIcon className="w-6 h-6 mx-auto mb-2" style={{ color: "oklch(0.30 0.006 240)" }} />
                <p className="text-xs" style={{ color: S.dim }}>上传参考图后，点击「生成三视图」</p>
                <p className="text-[10px] mt-1" style={{ color: "oklch(0.38 0.008 240)" }}>Gemini 3 Pro Image 将生成包含正面/侧面/背面的道具三视图</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function EpisodeSection({ episodeId, episodeTitle }: { episodeId: string; episodeTitle: string }) {
  const { episodeAssets, addEpisodeAsset } = useProject();
  const [collapsed, setCollapsed] = useState(false);
  const props = episodeAssets.filter(a => a.episodeId === episodeId && a.type === "prop");
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between p-3 rounded cursor-pointer" style={{ background: "oklch(0.13 0.005 240)", border: "1px solid oklch(0.20 0.006 240)" }} onClick={() => setCollapsed(c => !c)}>
        <div className="flex items-center gap-3">
          <Package className="w-4 h-4" style={{ color: S.orange }} />
          <span className="font-semibold text-sm" style={{ color: S.text, fontFamily: S.grotesk }}>{episodeTitle}</span>
          <span className="text-xs px-2 py-0.5 rounded" style={{ background: "oklch(0.70 0.18 55 / 0.15)", border: "1px solid oklch(0.70 0.18 55 / 0.3)", color: S.orange, fontFamily: S.mono }}>{props.length} 道具</span>
        </div>
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          <Button size="sm" onClick={() => addEpisodeAsset(episodeId, "prop")} style={{ background: "oklch(0.70 0.18 55 / 0.12)", border: "1px solid oklch(0.70 0.18 55 / 0.35)", color: S.orange }}><Plus className="w-3 h-3 mr-1" />添加道具</Button>
          <button onClick={() => setCollapsed(c => !c)} style={{ color: S.dim }}>{collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}</button>
        </div>
      </div>
      {!collapsed && (
        <div className="space-y-3 pl-4">
          {props.length === 0 ? <div className="p-4 text-center rounded" style={{ background: "oklch(0.12 0.005 240)", border: "1px dashed oklch(0.22 0.006 240)" }}><p className="text-xs" style={{ color: S.dim }}>暂无道具，点击「添加道具」开始</p></div> : props.map(asset => <PropAssetCard key={asset.id} asset={asset} />)}
        </div>
      )}
    </div>
  );
}

export default function Phase2c() {
  const { scriptAnalysis, episodeAssets, markPhaseComplete, setActivePhase } = useProject();
  const episodes = scriptAnalysis?.episodes ?? [];
  const totalProps = episodeAssets.filter(a => a.type === "prop").length;

  return (
    <div className="space-y-8">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-12 h-12 rounded flex items-center justify-center text-lg font-bold" style={{ background: "oklch(0.70 0.18 55 / 0.15)", border: "1px solid oklch(0.70 0.18 55 / 0.4)", color: S.orange, fontFamily: S.mono }}>2C</div>
        <div>
          <h2 className="text-xl font-bold mb-1" style={{ color: S.text, fontFamily: S.grotesk }}>道具资产</h2>
          <p className="text-sm" style={{ color: S.sub }}>MJ7 提示词 → 上传参考图 → Gemini 3 Pro Image 生成一张三视图（正面/侧面/背面）→ 导入资产库</p>
        </div>
      </div>

      <div className="p-4 rounded" style={{ background: "oklch(0.13 0.005 240)", border: "1px solid oklch(0.20 0.006 240)" }}>
        <div className="flex flex-wrap gap-4 text-xs" style={{ color: S.dim }}>
          <div className="flex items-center gap-1.5"><span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: "oklch(0.75 0.17 65 / 0.15)", color: S.amber, fontFamily: S.mono }}>STEP 1</span>AI 生成 MJ7 提示词 → 复制到 Midjourney</div>
          <span style={{ color: "oklch(0.30 0.006 240)" }}>→</span>
          <div className="flex items-center gap-1.5"><span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: "oklch(0.55 0.18 290 / 0.15)", color: S.purple, fontFamily: S.mono }}>STEP 2</span>上传 MJ 参考图 + Nano 辅助提示词</div>
          <span style={{ color: "oklch(0.30 0.006 240)" }}>→</span>
          <div className="flex items-center gap-1.5"><span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: "oklch(0.60 0.18 240 / 0.15)", color: S.blue, fontFamily: S.mono }}>STEP 3</span>Nano 生成道具三视图（正面/侧面/背面）</div>
          <span style={{ color: "oklch(0.30 0.006 240)" }}>→</span>
          <div className="flex items-center gap-1.5"><Library className="w-3 h-3" style={{ color: S.green }} />导入资产库</div>
        </div>
      </div>

      {totalProps > 0 && <div className="flex items-center gap-2 text-xs" style={{ color: S.dim }}><Package className="w-3.5 h-3.5" style={{ color: S.orange }} />共 {totalProps} 个道具资产</div>}

      {episodes.length === 0 ? (
        <div className="p-8 text-center rounded" style={S.card}><p className="text-sm" style={{ color: S.dim }}>请先在阶段一完成剧本解析，系统将自动提取分集信息</p></div>
      ) : (
        <div className="space-y-6">{episodes.map(ep => <EpisodeSection key={ep.id} episodeId={ep.id} episodeTitle={ep.title || `第 ${ep.number} 集`} />)}</div>
      )}

      <div className="flex justify-end pt-4 border-t" style={{ borderColor: "oklch(0.22 0.006 240)" }}>
        <Button onClick={() => { markPhaseComplete("phase2c"); setActivePhase("phase3"); }} className="gap-2" style={{ background: "oklch(0.70 0.18 55)", color: "oklch(0.10 0.005 240)", fontWeight: 700 }}>
          道具资产完成，进入分镜脚本<ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
