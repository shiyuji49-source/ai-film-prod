// Phase2: 统一资产设计板块（人物 / 场景 / 道具）
// 顶部选项卡切换三个子板块
import { useProject } from "@/contexts/ProjectContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  ChevronRight, Wand2, Copy, Check, Loader2, Upload, ImageIcon,
  Download, Library, RefreshCw, CheckCircle2, Bot, User, Merge,
  Mountain, Package, Users, Plus, Trash2, ChevronDown, ChevronUp, LayoutGrid,
} from "lucide-react";
import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { AIEstimateHint } from "@/components/AIEstimateHint";
import { GEMINI_ESTIMATE_SECS } from "@shared/const";
import type { EpisodeAsset } from "@/contexts/ProjectContext";

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  card: { background: "oklch(0.15 0.006 240)", border: "1px solid oklch(0.22 0.006 240)", borderRadius: "8px" } as React.CSSProperties,
  innerCard: { background: "oklch(0.12 0.005 240)", border: "1px solid oklch(0.20 0.006 240)", borderRadius: "6px" } as React.CSSProperties,
  amber: "oklch(0.75 0.17 65)",
  green: "oklch(0.65 0.2 145)",
  blue: "oklch(0.60 0.18 240)",
  purple: "oklch(0.65 0.18 290)",
  teal: "oklch(0.65 0.15 185)",
  orange: "oklch(0.70 0.18 55)",
  dim: "oklch(0.55 0.01 240)",
  text: "oklch(0.88 0.005 60)",
  sub: "oklch(0.70 0.008 240)",
  mono: "'JetBrains Mono', monospace" as const,
  grotesk: "'Space Grotesk', sans-serif" as const,
};

// ─── CopyButton ───────────────────────────────────────────────────────────────
function CopyButton({ text, label = "复制" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); toast.success("已复制"); setTimeout(() => setCopied(false), 1500); }}
      className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-all"
      style={{ background: copied ? "oklch(0.65 0.2 145 / 0.15)" : "oklch(0.22 0.006 240)", border: `1px solid ${copied ? "oklch(0.65 0.2 145 / 0.4)" : "oklch(0.28 0.008 240)"}`, color: copied ? S.green : "oklch(0.60 0.01 240)", fontFamily: S.mono }}>
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? "已复制" : label}
    </button>
  );
}

// ─── ImageUploadZone ──────────────────────────────────────────────────────────
function ImageUploadZone({ imageUrl, onUpload, uploading, label = "点击或拖拽上传 MJ 生成的参考图", accentColor = S.amber }: {
  imageUrl?: string | null;
  onUpload: (base64: string, mimeType: string) => void;
  uploading: boolean;
  label?: string;
  accentColor?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleFile = useCallback((file: File) => {
    if (file.size > 16 * 1024 * 1024) { toast.error("图片大小不能超过 16MB"); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      const [header, base64] = result.split(",");
      const mimeType = header.match(/data:(.*);base64/)?.[1] ?? "image/jpeg";
      onUpload(base64, mimeType);
    };
    reader.readAsDataURL(file);
  }, [onUpload]);

  return (
    <div className="relative border-2 border-dashed rounded-lg overflow-hidden cursor-pointer transition-all"
      style={{ borderColor: imageUrl ? accentColor : "oklch(0.28 0.008 240)", background: "oklch(0.10 0.004 240)", minHeight: "140px" }}
      onClick={() => inputRef.current?.click()}
      onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type.startsWith("image/")) handleFile(f); }}
      onDragOver={(e) => e.preventDefault()}>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      {imageUrl ? (
        <div className="relative" style={{ minHeight: "140px" }}>
          <img src={imageUrl} alt="参考图" className="w-full object-contain" style={{ maxHeight: "200px" }} />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity" style={{ background: "oklch(0 0 0 / 0.6)" }}>
            <span className="text-xs" style={{ color: S.text }}>点击重新上传</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 p-6" style={{ minHeight: "140px" }}>
          {uploading
            ? <Loader2 className="w-6 h-6 animate-spin" style={{ color: accentColor }} />
            : <><Upload className="w-6 h-6" style={{ color: "oklch(0.35 0.008 240)" }} /><p className="text-xs text-center" style={{ color: S.dim }}>{label}</p><p className="text-[10px]" style={{ color: "oklch(0.38 0.008 240)" }}>最大 16MB · JPG / PNG / WEBP</p></>
          }
        </div>
      )}
    </div>
  );
}

// 强制下载图片（通过后端代理绕过 CORS）
async function forceDownload(url: string, filename: string) {
  try {
    // 优先使用后端代理接口，完全绕过 CORS
    const proxyUrl = `/api/download-proxy?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
    const resp = await fetch(proxyUrl);
    if (!resp.ok) throw new Error(`Proxy failed: ${resp.status}`);
    const blob = await resp.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch {
    // 最后备用：直接打开
    window.open(url, "_blank");
  }
}

// ─── ViewPanel: 单个视角图面板（人物用，9:16） ────────────────────────────────
function ViewPanel({ viewType, label, color, imageUrl, loading, disabled, onGenerate, charName }: {
  viewType: "closeup" | "front" | "side" | "back";
  label: string;
  color: string;
  imageUrl?: string | null;
  loading: boolean;
  disabled: boolean;
  onGenerate: () => void;
  charName: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${color}22`, border: `1px solid ${color}55`, color, fontFamily: S.mono }}>{label}</span>
        <button onClick={onGenerate} disabled={loading || disabled}
          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-all disabled:opacity-40"
          style={{ background: imageUrl ? "oklch(0.55 0.18 290 / 0.12)" : `${color}22`, border: `1px solid ${imageUrl ? "oklch(0.55 0.18 290 / 0.4)" : `${color}55`}`, color: imageUrl ? S.purple : color, fontFamily: S.mono }}>
          {loading ? <><Loader2 className="w-2.5 h-2.5 animate-spin" />生成中</> : imageUrl ? <><RefreshCw className="w-2.5 h-2.5" />重新</> : <><Wand2 className="w-2.5 h-2.5" />生成</>}
        </button>
      </div>
      {/* 9:16 比例固定 */}
      <div className="rounded overflow-hidden" style={{ background: "oklch(0.10 0.004 240)", border: "1px solid oklch(0.22 0.006 240)", aspectRatio: "9/16" }}>
        {imageUrl
          ? <img src={imageUrl} alt={label} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex flex-col items-center justify-center gap-1.5">
            <ImageIcon className="w-5 h-5" style={{ color: "oklch(0.30 0.006 240)" }} />
            <span className="text-[9px]" style={{ color: "oklch(0.35 0.006 240)", fontFamily: S.mono }}>{disabled ? "先上传参考图" : "待生成"}</span>
          </div>
        }
      </div>
      {imageUrl && (
        <button onClick={() => forceDownload(imageUrl, `${charName}-${label}.png`)}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] w-fit transition-all hover:opacity-80"
          style={{ background: "oklch(0.22 0.006 240)", border: "1px solid oklch(0.28 0.008 240)", color: S.dim, fontFamily: S.mono }}>
          <Download className="w-2.5 h-2.5" />下载
        </button>
      )}
    </div>
  );
}

// ─── CharacterCard ────────────────────────────────────────────────────────────
function CharacterCard({ char }: { char: ReturnType<typeof useProject>["characters"][0] }) {
  const { projectInfo, updateCharacter } = useProject();
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();

  const [uploading, setUploading] = useState(false);
  const [generatingMJ, setGeneratingMJ] = useState(false);
  const [generatingView, setGeneratingView] = useState<Record<string, boolean>>({});
  const [generatingAllViews, setGeneratingAllViews] = useState(false);
  const [merging, setMerging] = useState(false);
  const [importing, setImporting] = useState(false);

  const generateMJMutation = trpc.ai.generateCharacterPrompt.useMutation();
  const isQVersion = char.isQVersion ?? false;
  const createAssetMutation = trpc.assets.create.useMutation();
  const uploadMutation = trpc.assets.uploadImage.useMutation();
  const generateViewMutation = trpc.assets.generateCharacterView.useMutation();
  const mergeDesignMutation = trpc.assets.mergeCharacterDesign.useMutation();

  const getOrCreateAssetId = async (): Promise<number> => {
    if (char.assetLibId) return char.assetLibId;
    const asset = await createAssetMutation.mutateAsync({ type: "character", name: char.name, description: char.appearance || char.name, mjPrompt: char.promptEn || undefined, mainPrompt: char.nanoPrompt || undefined });
    updateCharacter(char.id, { assetLibId: asset.id });
    return asset.id;
  };

  const handleGenerateMJ = async () => {
    setGeneratingMJ(true);
    try {
      const result = await generateMJMutation.mutateAsync({ name: char.name, role: char.role || "角色", isMecha: char.isMecha ?? false, isQVersion: char.isQVersion ?? false, appearance: char.appearance || char.name, costume: char.costume || "", marks: char.marks || "", styleZh: projectInfo.styleZh, styleEn: projectInfo.styleEn });
      updateCharacter(char.id, { promptZh: result.zh, promptEn: result.en, ...(result.qVersionZh ? { qVersionPromptZh: result.qVersionZh } : {}), ...(result.qVersionEn ? { qVersionPromptEn: result.qVersionEn } : {}) });
      toast.success(`${char.name} MJ7 提示词已生成`);
    } catch (err) { toast.error(`生成失败：${err instanceof Error ? err.message : "未知错误"}`); }
    finally { setGeneratingMJ(false); }
  };

  const handleUpload = async (base64: string, mimeType: string) => {
    if (!isAuthenticated) { toast.error("请先登录后再上传图片"); return; }
    setUploading(true);
    try {
      const assetId = await getOrCreateAssetId();
      const result = await uploadMutation.mutateAsync({ id: assetId, imageBase64: base64, mimeType });
      updateCharacter(char.id, { uploadedImageUrl: result.uploadedImageUrl });
      utils.assets.list.invalidate();
      toast.success("参考图已上传！请分别生成4张视角图");
    } catch (err) { toast.error(`上传失败：${err instanceof Error ? err.message : "未知错误"}`); }
    finally { setUploading(false); }
  };

  const handleGenerateView = async (viewType: "closeup" | "front" | "side" | "back") => {
    if (!char.uploadedImageUrl) { toast.error("请先上传 MJ 参考图"); return; }
    if (!isAuthenticated) { toast.error("请先登录后再生成图片"); return; }
    setGeneratingView(prev => ({ ...prev, [viewType]: true }));
    try {
      const assetId = await getOrCreateAssetId();
      const result = await generateViewMutation.mutateAsync({ id: assetId, viewType, nanoPrompt: char.nanoPrompt || undefined });
      const fieldMap: Record<string, string> = { closeup: "closeupImageUrl", front: "frontImageUrl", side: "sideImageUrl", back: "backImageUrl" };
      updateCharacter(char.id, { [fieldMap[viewType]]: result.imageUrl });
      utils.assets.list.invalidate();
      const labelMap: Record<string, string> = { closeup: "近景肖像", front: "正视全身", side: "侧视全身", back: "背视全身" };
      toast.success(`${labelMap[viewType]}生成完成！`);
    } catch (err) { toast.error(`生成失败：${err instanceof Error ? err.message : "未知错误"}`); }
    finally { setGeneratingView(prev => ({ ...prev, [viewType]: false })); }
  };

  const handleGenerateAllViews = async () => {
    if (!char.uploadedImageUrl) { toast.error("请先上传 MJ 参考图"); return; }
    if (!isAuthenticated) { toast.error("请先登录后再生成图片"); return; }
    setGeneratingAllViews(true);
    const views: ("closeup" | "front" | "side" | "back")[] = ["closeup", "front", "side", "back"];
    const fieldMap: Record<string, string> = { closeup: "closeupImageUrl", front: "frontImageUrl", side: "sideImageUrl", back: "backImageUrl" };
    const labelMap: Record<string, string> = { closeup: "近景肖像", front: "正视全身", side: "侧视全身", back: "背视全身" };
    for (const viewType of views) {
      setGeneratingView(prev => ({ ...prev, [viewType]: true }));
      try {
        const assetId = await getOrCreateAssetId();
        const result = await generateViewMutation.mutateAsync({ id: assetId, viewType, nanoPrompt: char.nanoPrompt || undefined });
        updateCharacter(char.id, { [fieldMap[viewType]]: result.imageUrl });
        toast.success(`${labelMap[viewType]}生成完成！`);
      } catch (err) { toast.error(`${labelMap[viewType]}生成失败：${err instanceof Error ? err.message : "未知错误"}`); }
      finally { setGeneratingView(prev => ({ ...prev, [viewType]: false })); }
    }
    setGeneratingAllViews(false);
    utils.assets.list.invalidate();
  };

  const handleMerge = async () => {
    const { closeupImageUrl, frontImageUrl, sideImageUrl, backImageUrl } = char;
    if (!closeupImageUrl || !frontImageUrl || !sideImageUrl || !backImageUrl) { toast.error("请先生成全部4张视角图（近景/正视/侧视/背视）"); return; }
    if (!isAuthenticated) { toast.error("请先登录后再拼合图片"); return; }
    setMerging(true);
    try {
      const assetId = await getOrCreateAssetId();
      const result = await mergeDesignMutation.mutateAsync({ id: assetId, closeupUrl: closeupImageUrl, frontUrl: frontImageUrl, sideUrl: sideImageUrl, backUrl: backImageUrl, charName: char.name });
      updateCharacter(char.id, { designImageUrl: result.imageUrl, mainImageUrl: result.imageUrl });
      utils.assets.list.invalidate();
      toast.success("16:9 角色设计主图拼合完成！");
    } catch (err) { toast.error(`拼合失败：${err instanceof Error ? err.message : "未知错误"}`); }
    finally { setMerging(false); }
  };

  const handleImport = async () => {
    if (!isAuthenticated) { toast.error("请先登录后再导入资产库"); return; }
    setImporting(true);
    try { await getOrCreateAssetId(); utils.assets.list.invalidate(); toast.success(`${char.name} 已导入资产库`); }
    catch (err) { toast.error(`导入失败：${err instanceof Error ? err.message : "未知错误"}`); }
    finally { setImporting(false); }
  };

  const designImage = char.designImageUrl || char.mainImageUrl;
  const allViewsDone = !!(char.closeupImageUrl && char.frontImageUrl && char.sideImageUrl && char.backImageUrl);
  const anyViewDone = !!(char.closeupImageUrl || char.frontImageUrl || char.sideImageUrl || char.backImageUrl);
  const viewConfigs: { viewType: "closeup" | "front" | "side" | "back"; label: string; color: string; urlKey: keyof typeof char }[] = [
    { viewType: "closeup", label: "近景肖像", color: S.amber, urlKey: "closeupImageUrl" },
    { viewType: "front", label: "正视全身", color: S.blue, urlKey: "frontImageUrl" },
    { viewType: "side", label: "侧视全身", color: S.purple, urlKey: "sideImageUrl" },
    { viewType: "back", label: "背视全身", color: S.green, urlKey: "backImageUrl" },
  ];

  return (
    <div className="p-4 space-y-5" style={S.card}>
      {/* 标题行 */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {char.isMecha ? <Bot className="w-4 h-4 flex-shrink-0" style={{ color: S.blue }} /> : <User className="w-4 h-4 flex-shrink-0" style={{ color: S.amber }} />}
          <span className="font-bold text-base" style={{ color: S.text, fontFamily: S.grotesk }}>{char.name}</span>
          {char.isMecha && <Badge className="text-xs px-1.5 py-0" style={{ background: "oklch(0.55 0.18 240 / 0.15)", border: "1px solid oklch(0.55 0.18 240 / 0.4)", color: S.blue }}>机甲</Badge>}
          {!char.isMecha && (
            <button onClick={() => updateCharacter(char.id, { isQVersion: !isQVersion })}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-all"
              style={{ background: isQVersion ? "oklch(0.65 0.18 320 / 0.15)" : "oklch(0.22 0.006 240)", border: `1px solid ${isQVersion ? "oklch(0.65 0.18 320 / 0.4)" : "oklch(0.30 0.008 240)"}`, color: isQVersion ? "oklch(0.75 0.18 320)" : S.dim, fontFamily: S.mono }}>
              {isQVersion ? "♥ Q版" : "□ Q版"}
            </button>
          )}
          {char.role && <Badge className="text-xs px-1.5 py-0" style={{ background: "oklch(0.22 0.006 240)", border: "1px solid oklch(0.30 0.008 240)", color: S.dim }}>{char.role}</Badge>}
          {char.assetLibId && <Badge className="text-xs px-1.5 py-0" style={{ background: "oklch(0.65 0.2 145 / 0.15)", border: "1px solid oklch(0.65 0.2 145 / 0.4)", color: S.green }}><CheckCircle2 className="w-2.5 h-2.5 mr-1" />已入库</Badge>}
        </div>
        <Button size="sm" onClick={handleImport} disabled={importing} style={{ background: "oklch(0.65 0.2 145 / 0.12)", border: "1px solid oklch(0.65 0.2 145 / 0.35)", color: S.green, flexShrink: 0 }}>
          {importing ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Library className="w-3 h-3 mr-1" />}导入资产库
        </Button>
      </div>

      {/* 人物基础信息 */}
      {(char.appearance || char.costume || char.marks) && (
        <div className="grid grid-cols-1 gap-1.5 text-xs p-3 rounded" style={S.innerCard}>
          {char.appearance && <div className="flex gap-2"><span className="flex-shrink-0 w-8" style={{ color: S.dim, fontFamily: S.mono }}>外貌</span><span style={{ color: S.sub }}>{char.appearance}</span></div>}
          {char.costume && <div className="flex gap-2"><span className="flex-shrink-0 w-8" style={{ color: S.dim, fontFamily: S.mono }}>服装</span><span style={{ color: S.sub }}>{char.costume}</span></div>}
          {char.marks && <div className="flex gap-2"><span className="flex-shrink-0 w-8" style={{ color: S.dim, fontFamily: S.mono }}>标记</span><span style={{ color: S.sub }}>{char.marks}</span></div>}
        </div>
      )}

      {/* STEP 1: MJ7 提示词 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: "oklch(0.75 0.17 65 / 0.15)", border: "1px solid oklch(0.75 0.17 65 / 0.3)", color: S.amber, fontFamily: S.mono }}>STEP 1</span>
            <span className="text-xs font-semibold" style={{ color: S.amber, fontFamily: S.grotesk }}>MJ7 提示词</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleGenerateMJ} disabled={generatingMJ} style={{ background: "oklch(0.75 0.17 65 / 0.12)", border: "1px solid oklch(0.75 0.17 65 / 0.35)", color: S.amber }}>
              {generatingMJ ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />生成中</> : <><Wand2 className="w-3 h-3 mr-1" />{char.promptZh ? "重新生成" : "AI 生成"}</>}
            </Button>
            <AIEstimateHint isLoading={generatingMJ} min={GEMINI_ESTIMATE_SECS.generateCharacter.min} max={GEMINI_ESTIMATE_SECS.generateCharacter.max} />
          </div>
        </div>
        {char.promptZh && char.promptEn ? (
          <div className="space-y-2">
            <div className="p-3 rounded text-xs leading-relaxed" style={{ background: "oklch(0.10 0.004 240)", border: "1px solid oklch(0.22 0.006 240)", color: "oklch(0.75 0.008 240)", fontFamily: S.mono, whiteSpace: "pre-wrap" }}>
              <div className="flex items-start justify-between gap-2 mb-1"><span style={{ color: S.dim }}>ZH</span><CopyButton text={char.promptZh} /></div>
              {char.promptZh}
            </div>
            <div className="p-3 rounded text-xs leading-relaxed" style={{ background: "oklch(0.10 0.004 240)", border: "1px solid oklch(0.22 0.006 240)", color: "oklch(0.70 0.008 240)", fontFamily: S.mono, whiteSpace: "pre-wrap" }}>
              <div className="flex items-start justify-between gap-2 mb-1"><span style={{ color: S.dim }}>EN</span><CopyButton text={char.promptEn} /></div>
              {char.promptEn}
            </div>
            {isQVersion && (char.qVersionPromptZh || char.qVersionPromptEn) && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "oklch(0.65 0.18 320 / 0.15)", border: "1px solid oklch(0.65 0.18 320 / 0.3)", color: "oklch(0.75 0.18 320)", fontFamily: S.mono }}>♥ Q版形象</span>
                </div>
                {char.qVersionPromptZh && <div className="p-3 rounded text-xs leading-relaxed" style={{ background: "oklch(0.10 0.004 240)", border: "1px solid oklch(0.65 0.18 320 / 0.25)", color: "oklch(0.75 0.008 240)", fontFamily: S.mono, whiteSpace: "pre-wrap" }}><div className="flex items-start justify-between gap-2 mb-1"><span style={{ color: "oklch(0.65 0.18 320 / 0.7)" }}>ZH</span><CopyButton text={char.qVersionPromptZh} /></div>{char.qVersionPromptZh}</div>}
                {char.qVersionPromptEn && <div className="p-3 rounded text-xs leading-relaxed" style={{ background: "oklch(0.10 0.004 240)", border: "1px solid oklch(0.65 0.18 320 / 0.25)", color: "oklch(0.70 0.008 240)", fontFamily: S.mono, whiteSpace: "pre-wrap" }}><div className="flex items-start justify-between gap-2 mb-1"><span style={{ color: "oklch(0.65 0.18 320 / 0.7)" }}>EN</span><CopyButton text={char.qVersionPromptEn} /></div>{char.qVersionPromptEn}</div>}
              </div>
            )}
          </div>
        ) : (
          <div className="p-3 rounded text-xs text-center" style={{ background: "oklch(0.10 0.004 240)", border: "1px dashed oklch(0.28 0.008 240)", color: S.dim }}>点击「AI 生成」，AI 将基于角色信息生成专属 MJ7 提示词</div>
        )}
      </div>

      {/* STEP 2: 上传 MJ 参考图（固定9:16展示） */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: "oklch(0.55 0.18 290 / 0.15)", border: "1px solid oklch(0.55 0.18 290 / 0.3)", color: S.purple, fontFamily: S.mono }}>STEP 2</span>
          <span className="text-xs font-semibold" style={{ color: S.purple, fontFamily: S.grotesk }}>上传 MJ 参考图（9:16 竖版）</span>
        </div>
        {/* 9:16 比例上传区 */}
        <div style={{ maxWidth: "160px" }}>
          <div className="rounded-lg overflow-hidden" style={{ aspectRatio: "9/16", background: "oklch(0.10 0.004 240)", border: char.uploadedImageUrl ? "2px solid oklch(0.75 0.17 65 / 0.5)" : "2px dashed oklch(0.28 0.008 240)", cursor: "pointer", position: "relative" }}
            onClick={() => document.getElementById(`char-upload-${char.id}`)?.click()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type.startsWith("image/")) { if (f.size > 16 * 1024 * 1024) { toast.error("图片大小不能超过 16MB"); return; } const reader = new FileReader(); reader.onload = (ev) => { const r = ev.target?.result as string; const [h, b] = r.split(","); handleUpload(b, h.match(/data:(.*);base64/)?.[1] ?? "image/jpeg"); }; reader.readAsDataURL(f); } }}
            onDragOver={(e) => e.preventDefault()}>
            <input id={`char-upload-${char.id}`} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { if (f.size > 16 * 1024 * 1024) { toast.error("图片大小不能超过 16MB"); return; } const reader = new FileReader(); reader.onload = (ev) => { const r = ev.target?.result as string; const [h, b] = r.split(","); handleUpload(b, h.match(/data:(.*);base64/)?.[1] ?? "image/jpeg"); }; reader.readAsDataURL(f); } }} />
            {char.uploadedImageUrl ? (
              <>
                <img src={char.uploadedImageUrl} alt="参考图" className="w-full h-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity" style={{ background: "oklch(0 0 0 / 0.6)" }}>
                  {uploading ? <Loader2 className="w-6 h-6 animate-spin" style={{ color: S.amber }} /> : <span className="text-xs" style={{ color: S.text }}>点击重新上传</span>}
                </div>
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-3">
                {uploading ? <Loader2 className="w-6 h-6 animate-spin" style={{ color: S.amber }} /> : <><Upload className="w-5 h-5" style={{ color: "oklch(0.35 0.008 240)" }} /><p className="text-[10px] text-center" style={{ color: S.dim }}>点击或拖拽上传</p><p className="text-[9px]" style={{ color: "oklch(0.38 0.008 240)" }}>9:16 竖版</p></>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* STEP 3: 分别生成4张9:16视角图 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: "oklch(0.60 0.18 240 / 0.15)", border: "1px solid oklch(0.60 0.18 240 / 0.3)", color: S.blue, fontFamily: S.mono }}>STEP 3</span>
            <span className="text-xs font-semibold" style={{ color: S.blue, fontFamily: S.grotesk }}>分别生成4张视角图（9:16 竖版）</span>
            {anyViewDone && <span className="text-[10px]" style={{ color: S.dim, fontFamily: S.mono }}>{[char.closeupImageUrl, char.frontImageUrl, char.sideImageUrl, char.backImageUrl].filter(Boolean).length}/4 已完成</span>}
          </div>
          <Button size="sm" onClick={handleGenerateAllViews} disabled={generatingAllViews || !char.uploadedImageUrl || Object.values(generatingView).some(Boolean)}
            style={{ background: "oklch(0.60 0.18 240 / 0.12)", border: "1px solid oklch(0.60 0.18 240 / 0.35)", color: S.blue, flexShrink: 0 }}>
            {generatingAllViews ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />生成中…</> : <><Wand2 className="w-3 h-3 mr-1" />一键生成4张</>}
          </Button>
        </div>
        {!char.uploadedImageUrl && <div className="p-3 rounded text-xs text-center" style={{ background: "oklch(0.10 0.004 240)", border: "1px dashed oklch(0.28 0.008 240)", color: S.dim }}>请先完成 STEP 2 上传 MJ 参考图</div>}
        <div className="grid grid-cols-4 gap-3">
          {viewConfigs.map(({ viewType, label, color, urlKey }) => (
            <ViewPanel key={viewType} viewType={viewType} label={label} color={color} imageUrl={char[urlKey] as string | null | undefined} loading={!!generatingView[viewType]} disabled={!char.uploadedImageUrl} onGenerate={() => handleGenerateView(viewType)} charName={char.name} />
          ))}
        </div>
        {char.uploadedImageUrl && <p className="text-[10px]" style={{ color: S.dim }}>每张图单独生成，可重新生成不满意的视角。每张消耗 5 积分。</p>}
      </div>

      {/* STEP 4: 拼合成16:9设计主图 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: "oklch(0.65 0.2 145 / 0.15)", border: "1px solid oklch(0.65 0.2 145 / 0.3)", color: S.green, fontFamily: S.mono }}>STEP 4</span>
            <span className="text-xs font-semibold" style={{ color: S.green, fontFamily: S.grotesk }}>拼合成16:9角色设计主图</span>
          </div>
          <Button size="sm" onClick={handleMerge} disabled={merging || !allViewsDone}
            style={{ background: designImage ? "oklch(0.55 0.18 290 / 0.12)" : "oklch(0.65 0.2 145 / 0.12)", border: `1px solid ${designImage ? "oklch(0.55 0.18 290 / 0.4)" : "oklch(0.65 0.2 145 / 0.35)"}`, color: designImage ? S.purple : S.green, opacity: allViewsDone ? 1 : 0.5 }}>
            {merging ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />拼合中</> : designImage ? <><RefreshCw className="w-3 h-3 mr-1" />重新拼合</> : <><Merge className="w-3 h-3 mr-1" />拼合4图为16:9</>}
          </Button>
        </div>
        {!allViewsDone && <p className="text-[10px]" style={{ color: S.dim }}>需先完成全部4张视角图的生成，才能拼合</p>}
        {designImage ? (
          <div className="space-y-2">
            <div className="rounded-lg overflow-hidden" style={{ border: "1px solid oklch(0.25 0.008 240)", background: "oklch(0.08 0.003 240)" }}>
              <img src={designImage} alt="角色设计主图（16:9）" className="w-full h-auto block" />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => forceDownload(designImage, `${char.name}-角色设计主图-16x9.png`)}
                className="flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-all hover:opacity-80"
                style={{ background: "oklch(0.22 0.006 240)", border: "1px solid oklch(0.28 0.008 240)", color: S.sub, fontFamily: S.mono }}>
                <Download className="w-2.5 h-2.5" />下载16:9合图
              </button>
              <span className="text-[10px]" style={{ color: S.dim }}>布局：近景肖像 | 正视全身 | 侧视全身 | 背视全身（底部含角色名标注）</span>
            </div>
          </div>
        ) : (
          <div className="p-6 rounded text-center" style={{ background: "oklch(0.10 0.004 240)", border: "1px dashed oklch(0.28 0.008 240)" }}>
            <ImageIcon className="w-8 h-8 mx-auto mb-2" style={{ color: "oklch(0.30 0.006 240)" }} />
            <p className="text-xs" style={{ color: S.dim }}>{allViewsDone ? "4张视角图已就绪，点击「拼合4图为16:9」生成角色设计主图" : "完成4张视角图后，系统将自动拼合为16:9横版角色设计主图"}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SceneAssetCard（场景，单张参考图，画幅跟随项目设置） ──────────────────────
function SceneAssetCard({ asset, orientation }: { asset: EpisodeAsset; orientation: string }) {
  const { projectInfo, updateEpisodeAsset, removeEpisodeAsset, scriptAnalysis } = useProject();
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const isPortrait = orientation === "portrait";

  const [uploading, setUploading] = useState(false);
  const [generatingMJ, setGeneratingMJ] = useState(false);
  const [generatingMain, setGeneratingMain] = useState(false);
  const [generatingQuad, setGeneratingQuad] = useState(false);
  const [importing, setImporting] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const generateMJMutation = trpc.ai.generateAssetPrompt.useMutation();
  const generateQuadPromptMutation = trpc.ai.generateAssetPrompt.useMutation();
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
      const result = await generateMJMutation.mutateAsync({ type: "scene", name: asset.name || "场景", description: asset.description || asset.name || "场景", episodeContext: ep ? `第${ep.number}集《${ep.title}》：${ep.synopsis}` : undefined, styleZh: projectInfo.styleZh, styleEn: projectInfo.styleEn, orientation: (projectInfo.orientation as "landscape" | "portrait" | undefined) });
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
      toast.success("参考图已上传，请点击「生成场景图」开始生成");
    } catch (err) { toast.error(`上传失败：${err instanceof Error ? err.message : "未知错误"}`); }
    finally { setUploading(false); }
  };

  const handleGenerateMain = async () => {
    if (!asset.uploadedImageUrl) { toast.error("请先上传 MJ 参考图"); return; }
    if (!isAuthenticated) { toast.error("请先登录后再生成图片"); return; }
    setGeneratingMain(true);
    try {
      const assetId = await getOrCreateAssetId();
      // 根据画幅方向生成对应构图提示词
      const orientationHint = isPortrait
        ? "vertical portrait composition 9:16, full height scene, vertical framing"
        : "horizontal landscape composition 16:9, wide scene, cinematic framing";
      const prompt = asset.nanoPrompt ? `${orientationHint}, ${asset.nanoPrompt}` : orientationHint;
      const result = await generateMultiMutation.mutateAsync({ id: assetId, viewType: "front", prompt });
      updateEpisodeAsset(asset.id, { mainImageUrl: result.imageUrl });
      utils.assets.list.invalidate();
      toast.success("场景参考图生成完成！");
    } catch (err) { toast.error(`生成失败：${err instanceof Error ? err.message : "未知错误"}`); }
    finally { setGeneratingMain(false); }
  };

  const handleGenerateQuadView = async () => {
    if (!asset.uploadedImageUrl) { toast.error("请先在 STEP 2 上传 MJ 参考图"); return; }
    if (!isAuthenticated) { toast.error("请先登录后再生成图片"); return; }
    setGeneratingQuad(true);
    try {
      const assetId = await getOrCreateAssetId();
      const ep = scriptAnalysis?.episodes?.find(e => e.id === asset.episodeId);
      // 静默生成四宫格提示词（不展示给用户）
      const quadResult = await generateQuadPromptMutation.mutateAsync({
        type: "scene_quad",
        name: asset.name || "场景",
        description: asset.description || asset.name || "场景",
        episodeContext: ep ? `第${ep.number}集《${ep.title}》：${ep.synopsis}` : undefined,
        styleZh: projectInfo.styleZh,
        styleEn: projectInfo.styleEn,
        orientation: (projectInfo.orientation as "landscape" | "portrait" | undefined)
      });
      // 直接用四宫格提示词生成图片
      const result = await generateMultiMutation.mutateAsync({
        id: assetId,
        viewType: "quad",
        prompt: quadResult.en
      });
      updateEpisodeAsset(asset.id, { quadViewImageUrl: result.imageUrl });
      utils.assets.list.invalidate();
      toast.success("四宫格参考图生成完成！");
    } catch (err) { toast.error(`生成失败：${err instanceof Error ? err.message : "未知错误"}`); }
    finally { setGeneratingQuad(false); }
  };

  const handleImport = async () => {
    if (!isAuthenticated) { toast.error("请先登录后再导入资产"); return; }
    setImporting(true);
    try { await getOrCreateAssetId(); utils.assets.list.invalidate(); toast.success(`${asset.name || "场景"} 已导入资产库`); }
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

          {/* STEP 2: 上传 MJ 参考图 + 生成场景图（单张，画幅跟随项目） */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: "oklch(0.55 0.18 290 / 0.15)", border: "1px solid oklch(0.55 0.18 290 / 0.3)", color: S.purple, fontFamily: S.mono }}>STEP 2</span>
                <span className="text-xs font-semibold" style={{ color: S.purple }}>上传 MJ 参考图</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "oklch(0.60 0.18 240 / 0.1)", border: "1px solid oklch(0.60 0.18 240 / 0.3)", color: S.blue, fontFamily: S.mono }}>
                  {isPortrait ? "9:16 竖版" : "16:9 横版"}
                </span>
              </div>
              <Button size="sm" onClick={handleGenerateMain} disabled={generatingMain || !asset.uploadedImageUrl}
                style={{ background: asset.mainImageUrl ? "oklch(0.55 0.18 290 / 0.12)" : "oklch(0.60 0.18 240 / 0.12)", border: `1px solid ${asset.mainImageUrl ? "oklch(0.55 0.18 290 / 0.4)" : "oklch(0.60 0.18 240 / 0.35)"}`, color: asset.mainImageUrl ? S.purple : S.blue }}>
                {generatingMain ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />生成中</> : asset.mainImageUrl ? <><RefreshCw className="w-3 h-3 mr-1" />重新生成</> : <><Wand2 className="w-3 h-3 mr-1" />生成场景图</>}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {/* 上传区（左） */}
              <div>
                <p className="text-[10px] mb-1" style={{ color: S.dim }}>MJ 参考图</p>
                <ImageUploadZone imageUrl={asset.uploadedImageUrl} onUpload={handleUpload} uploading={uploading} accentColor={S.teal} label="点击或拖拽上传 MJ 参考图" />
              </div>
              {/* 生成结果（右），画幅跟随项目 */}
              <div>
                <p className="text-[10px] mb-1" style={{ color: S.dim }}>生成结果（{isPortrait ? "9:16" : "16:9"}）</p>
                <div className="rounded overflow-hidden" style={{ background: "oklch(0.10 0.004 240)", border: "1px solid oklch(0.22 0.006 240)", aspectRatio: isPortrait ? "9/16" : "16/9" }}>
                  {asset.mainImageUrl
                    ? <img src={asset.mainImageUrl} alt="场景图" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex flex-col items-center justify-center gap-1.5"><ImageIcon className="w-5 h-5" style={{ color: "oklch(0.30 0.006 240)" }} /><span className="text-[9px]" style={{ color: "oklch(0.35 0.006 240)", fontFamily: S.mono }}>待生成</span></div>
                  }
                </div>
                {asset.mainImageUrl && (
                  <button onClick={() => forceDownload(asset.mainImageUrl!, `${asset.name || "场景"}-参考图.png`)}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] w-fit mt-1 transition-all hover:opacity-80"
                    style={{ background: "oklch(0.22 0.006 240)", border: "1px solid oklch(0.28 0.008 240)", color: S.dim, fontFamily: S.mono }}>
                    <Download className="w-2.5 h-2.5" />下载
                  </button>
                )}
              </div>
            </div>
            {/* Nano 辅助提示词 */}
            <div className="space-y-1">
              <p className="text-[10px]" style={{ color: S.dim }}>Nano 辅助提示词（可选，追加到构图提示词末尾）</p>
              <Textarea value={asset.nanoPrompt || ""} onChange={e => updateEpisodeAsset(asset.id, { nanoPrompt: e.target.value })} placeholder="可选：输入额外要求，如 foggy atmosphere, dramatic lighting" rows={2} className="text-xs resize-none" style={{ background: "oklch(0.10 0.004 240)", border: "1px solid oklch(0.22 0.006 240)", color: S.sub, fontFamily: S.mono }} />
            </div>
          </div>

          {/* STEP 3: 四宫格四方向参考图（接 Gemini 3 Pro Image） */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: "oklch(0.55 0.18 160 / 0.15)", border: "1px solid oklch(0.55 0.18 160 / 0.3)", color: S.teal, fontFamily: S.mono }}>STEP 3</span>
                <span className="text-xs font-semibold" style={{ color: S.teal }}>四宫格四方向参考图</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "oklch(0.55 0.18 160 / 0.1)", border: "1px solid oklch(0.55 0.18 160 / 0.3)", color: S.teal, fontFamily: S.mono }}>Gemini 3 Pro Image</span>
              </div>
              <Button size="sm" onClick={handleGenerateQuadView} disabled={generatingQuad || !asset.uploadedImageUrl}
                style={{ background: asset.quadViewImageUrl ? "oklch(0.55 0.18 160 / 0.12)" : "oklch(0.55 0.18 160 / 0.12)", border: `1px solid ${asset.quadViewImageUrl ? "oklch(0.55 0.18 160 / 0.4)" : "oklch(0.55 0.18 160 / 0.35)"}`, color: S.teal }}>
                {generatingQuad ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />生成中</> : asset.quadViewImageUrl ? <><RefreshCw className="w-3 h-3 mr-1" />重新生成</> : <><Wand2 className="w-3 h-3 mr-1" />生成四宫格参考图</>}
              </Button>
            </div>
            <div className="rounded overflow-hidden" style={{ background: "oklch(0.10 0.004 240)", border: "1px solid oklch(0.22 0.006 240)", aspectRatio: isPortrait ? "9/16" : "16/9" }}>
              {asset.quadViewImageUrl
                ? <img src={asset.quadViewImageUrl} alt="四宫格参考图" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex flex-col items-center justify-center gap-1.5">
                    <LayoutGrid className="w-5 h-5" style={{ color: "oklch(0.30 0.006 240)" }} />
                    <span className="text-[9px]" style={{ color: "oklch(0.35 0.006 240)", fontFamily: S.mono }}>点击「生成四宫格参考图」</span>
                    <span className="text-[9px]" style={{ color: "oklch(0.30 0.006 240)", fontFamily: S.mono }}>需先在 STEP 2 上传 MJ 参考图</span>
                  </div>
              }
            </div>
            {asset.quadViewImageUrl && (
              <button onClick={() => forceDownload(asset.quadViewImageUrl!, `${asset.name || "场景"}-四宫格参考图.png`)}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] w-fit transition-all hover:opacity-80"
                style={{ background: "oklch(0.22 0.006 240)", border: "1px solid oklch(0.28 0.008 240)", color: S.dim, fontFamily: S.mono }}>
                <Download className="w-2.5 h-2.5" />下载四宫格参考图
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── PropAssetCard（道具，单张参考图，画幅跟随项目设置） ──────────────────────
function PropAssetCard({ asset, orientation }: { asset: EpisodeAsset; orientation: string }) {
  const { projectInfo, updateEpisodeAsset, removeEpisodeAsset, scriptAnalysis } = useProject();
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const isPortrait = orientation === "portrait";

  const [uploading, setUploading] = useState(false);
  const [generatingMJ, setGeneratingMJ] = useState(false);
  const [generatingMain, setGeneratingMain] = useState(false);
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
      const result = await generateMJMutation.mutateAsync({ type: "prop", name: asset.name || "道具", description: asset.description || asset.name || "道具", episodeContext: ep ? `第${ep.number}集《${ep.title}》：${ep.synopsis}` : undefined, styleZh: projectInfo.styleZh, styleEn: projectInfo.styleEn, orientation: (projectInfo.orientation as "landscape" | "portrait" | undefined) });
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
      toast.success("参考图已上传，请点击「生成道具图」开始生成");
    } catch (err) { toast.error(`上传失败：${err instanceof Error ? err.message : "未知错误"}`); }
    finally { setUploading(false); }
  };

  const handleGenerateMain = async () => {
    if (!asset.uploadedImageUrl) { toast.error("请先上传 MJ 参考图"); return; }
    if (!isAuthenticated) { toast.error("请先登录后再生成图片"); return; }
    setGeneratingMain(true);
    try {
      const assetId = await getOrCreateAssetId();
      const orientationHint = isPortrait
        ? "vertical portrait composition 9:16, product reference sheet, clean background, vertical framing"
        : "horizontal landscape composition 16:9, product reference sheet, clean background, wide framing";
      const prompt = asset.nanoPrompt ? `${orientationHint}, ${asset.nanoPrompt}` : orientationHint;
      const result = await generateMultiMutation.mutateAsync({ id: assetId, viewType: "front", prompt });
      updateEpisodeAsset(asset.id, { mainImageUrl: result.imageUrl });
      utils.assets.list.invalidate();
      toast.success("道具参考图生成完成！");
    } catch (err) { toast.error(`生成失败：${err instanceof Error ? err.message : "未知错误"}`); }
    finally { setGeneratingMain(false); }
  };

  const handleImport = async () => {
    if (!isAuthenticated) { toast.error("请先登录后再导入资产库"); return; }
    setImporting(true);
    try { await getOrCreateAssetId(); utils.assets.list.invalidate(); toast.success(`${asset.name || "道具"} 已导入资产库`); }
    catch (err) { toast.error(`导入失败：${err instanceof Error ? err.message : "未知错误"}`); }
    finally { setImporting(false); }
  };

  return (
    <div className="p-4 space-y-4" style={S.card}>
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

          {/* STEP 2: 上传 MJ 参考图 + 生成道具图（单张，画幅跟随项目） */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: "oklch(0.55 0.18 290 / 0.15)", border: "1px solid oklch(0.55 0.18 290 / 0.3)", color: S.purple, fontFamily: S.mono }}>STEP 2</span>
                <span className="text-xs font-semibold" style={{ color: S.purple }}>上传 MJ 参考图</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "oklch(0.60 0.18 240 / 0.1)", border: "1px solid oklch(0.60 0.18 240 / 0.3)", color: S.blue, fontFamily: S.mono }}>
                  {isPortrait ? "9:16 竖版" : "16:9 横版"}
                </span>
              </div>
              <Button size="sm" onClick={handleGenerateMain} disabled={generatingMain || !asset.uploadedImageUrl}
                style={{ background: asset.mainImageUrl ? "oklch(0.55 0.18 290 / 0.12)" : "oklch(0.70 0.18 55 / 0.12)", border: `1px solid ${asset.mainImageUrl ? "oklch(0.55 0.18 290 / 0.4)" : "oklch(0.70 0.18 55 / 0.35)"}`, color: asset.mainImageUrl ? S.purple : S.orange }}>
                {generatingMain ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />生成中</> : asset.mainImageUrl ? <><RefreshCw className="w-3 h-3 mr-1" />重新生成</> : <><Wand2 className="w-3 h-3 mr-1" />生成道具图</>}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] mb-1" style={{ color: S.dim }}>MJ 参考图</p>
                <ImageUploadZone imageUrl={asset.uploadedImageUrl} onUpload={handleUpload} uploading={uploading} accentColor={S.orange} label="点击或拖拽上传 MJ 参考图" />
              </div>
              <div>
                <p className="text-[10px] mb-1" style={{ color: S.dim }}>生成结果（{isPortrait ? "9:16" : "16:9"}）</p>
                <div className="rounded overflow-hidden" style={{ background: "oklch(0.10 0.004 240)", border: "1px solid oklch(0.22 0.006 240)", aspectRatio: isPortrait ? "9/16" : "16/9" }}>
                  {asset.mainImageUrl
                    ? <img src={asset.mainImageUrl} alt="道具图" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex flex-col items-center justify-center gap-1.5"><ImageIcon className="w-5 h-5" style={{ color: "oklch(0.30 0.006 240)" }} /><span className="text-[9px]" style={{ color: "oklch(0.35 0.006 240)", fontFamily: S.mono }}>待生成</span></div>
                  }
                </div>
                {asset.mainImageUrl && (
                  <button onClick={() => forceDownload(asset.mainImageUrl!, `${asset.name || "道具"}-参考图.png`)}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] w-fit mt-1 transition-all hover:opacity-80"
                    style={{ background: "oklch(0.22 0.006 240)", border: "1px solid oklch(0.28 0.008 240)", color: S.dim, fontFamily: S.mono }}>
                    <Download className="w-2.5 h-2.5" />下载
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[10px]" style={{ color: S.dim }}>Nano 辅助提示词（可选）</p>
              <Textarea value={asset.nanoPrompt || ""} onChange={e => updateEpisodeAsset(asset.id, { nanoPrompt: e.target.value })} placeholder="可选：输入额外要求，如 golden metallic surface, glowing runes" rows={2} className="text-xs resize-none" style={{ background: "oklch(0.10 0.004 240)", border: "1px solid oklch(0.22 0.006 240)", color: S.sub, fontFamily: S.mono }} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── EpisodeSection（场景/道具公用） ──────────────────────────────────────────
function EpisodeSection({ episodeId, episodeTitle, type, orientation }: { episodeId: string; episodeTitle: string; type: "scene" | "prop"; orientation: string }) {
  const { episodeAssets, addEpisodeAsset } = useProject();
  const [collapsed, setCollapsed] = useState(false);
  const assets = episodeAssets.filter(a => a.episodeId === episodeId && a.type === type);
  const color = type === "scene" ? S.teal : S.orange;
  const Icon = type === "scene" ? Mountain : Package;
  const label = type === "scene" ? "场景" : "道具";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between p-3 rounded cursor-pointer" style={{ background: "oklch(0.13 0.005 240)", border: "1px solid oklch(0.20 0.006 240)" }} onClick={() => setCollapsed(c => !c)}>
        <div className="flex items-center gap-3">
          <Icon className="w-4 h-4" style={{ color }} />
          <span className="font-semibold text-sm" style={{ color: S.text, fontFamily: S.grotesk }}>{episodeTitle}</span>
          <span className="text-xs px-2 py-0.5 rounded" style={{ background: `${color}22`, border: `1px solid ${color}44`, color, fontFamily: S.mono }}>{assets.length} {label}</span>
        </div>
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          <Button size="sm" onClick={() => addEpisodeAsset(episodeId, type)} style={{ background: `${color}22`, border: `1px solid ${color}55`, color }}>
            <Plus className="w-3 h-3 mr-1" />添加{label}
          </Button>
          <button onClick={() => setCollapsed(c => !c)} style={{ color: S.dim }}>{collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}</button>
        </div>
      </div>
      {!collapsed && (
        <div className="space-y-3 pl-4">
          {assets.length === 0
            ? <div className="p-4 text-center rounded" style={{ background: "oklch(0.12 0.005 240)", border: "1px dashed oklch(0.22 0.006 240)" }}><p className="text-xs" style={{ color: S.dim }}>暂无{label}，点击「添加{label}」开始</p></div>
            : assets.map(asset => type === "scene"
              ? <SceneAssetCard key={asset.id} asset={asset} orientation={orientation} />
              : <PropAssetCard key={asset.id} asset={asset} orientation={orientation} />
            )
          }
        </div>
      )}
    </div>
  );
}

// ─── Phase2 Main ──────────────────────────────────────────────────────────────
export default function Phase2() {
  const { characters, markPhaseComplete, setActivePhase, projectInfo, updateCharacter, scriptAnalysis, episodeAssets, updateEpisodeAsset } = useProject();
  const [activeTab, setActiveTab] = useState<"character" | "scene" | "prop">("character");
  const [generatingAll, setGeneratingAll] = useState(false);
  const [generatingAllScenes, setGeneratingAllScenes] = useState(false);
  const [generatingAllSceneProgress, setGeneratingAllSceneProgress] = useState<{ current: number; total: number; name: string } | null>(null);
  const orientation = projectInfo.orientation || "landscape";

  const generateMJMutation = trpc.ai.generateCharacterPrompt.useMutation();
  const generateSceneMJMutation = trpc.ai.generateAssetPrompt.useMutation();

  // 一键生成本集所有场景提示词（串行）
  const handleGenerateAllScenes = async () => {
    const scenes = episodeAssets.filter(a => a.type === "scene");
    if (scenes.length === 0) { toast.error("没有场景资产，请先完成剧本解析"); return; }
    setGeneratingAllScenes(true);
    let successCount = 0;
    let failCount = 0;
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      setGeneratingAllSceneProgress({ current: i + 1, total: scenes.length, name: scene.name || "未命名场景" });
      try {
        // 找到所属集数的上下文
        const ep = scriptAnalysis?.episodes?.find(e => e.id === scene.episodeId);
        const episodeContext = ep ? `第${ep.number}集《${ep.title}》：${ep.synopsis}` : undefined;
        const result = await generateSceneMJMutation.mutateAsync({
          type: "scene",
          name: scene.name || "场景",
          description: scene.description || scene.name || "场景",
          episodeContext,
          styleZh: projectInfo.styleZh,
          styleEn: projectInfo.styleEn,
          orientation: (projectInfo.orientation as "landscape" | "portrait" | undefined),
        });
        updateEpisodeAsset(scene.id, { promptMJ: JSON.stringify({ zh: result.zh, en: result.en }) });
        successCount++;
      } catch {
        failCount++;
      }
    }
    setGeneratingAllScenes(false);
    setGeneratingAllSceneProgress(null);
    if (failCount === 0) {
      toast.success(`全部 ${successCount} 个场景提示词生成完成`);
    } else {
      toast.warning(`完成 ${successCount} 个，失败 ${failCount} 个`);
    }
  };

  const handleGenerateAll = async () => {
    setGeneratingAll(true);
    for (const char of characters) {
      try {
        const result = await generateMJMutation.mutateAsync({ name: char.name, role: char.role || "角色", isMecha: char.isMecha ?? false, appearance: char.appearance || char.name, costume: char.costume || "", marks: char.marks || "", styleZh: projectInfo.styleZh, styleEn: projectInfo.styleEn });
        updateCharacter(char.id, { promptZh: result.zh, promptEn: result.en });
      } catch { /* continue */ }
    }
    setGeneratingAll(false);
    toast.success("全部人物 MJ7 提示词生成完成");
  };

  const episodes = scriptAnalysis?.episodes ?? [];
  const totalScenes = episodeAssets.filter(a => a.type === "scene").length;
  const totalProps = episodeAssets.filter(a => a.type === "prop").length;

  const tabs: { id: "character" | "scene" | "prop"; label: string; icon: React.ReactNode; count: number; color: string }[] = [
    { id: "character", label: "人物", icon: <Users className="w-4 h-4" />, count: characters.length, color: S.amber },
    { id: "scene", label: "场景", icon: <Mountain className="w-4 h-4" />, count: totalScenes, color: S.teal },
    { id: "prop", label: "道具", icon: <Package className="w-4 h-4" />, count: totalProps, color: S.orange },
  ];

  return (
    <div className="space-y-6">
      {/* Phase header */}
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-12 h-12 rounded flex items-center justify-center text-lg font-bold"
          style={{ background: "oklch(0.75 0.17 65 / 0.15)", border: "1px solid oklch(0.75 0.17 65 / 0.4)", color: S.amber, fontFamily: S.mono }}>02</div>
        <div>
          <h2 className="text-xl font-bold mb-1" style={{ color: S.text, fontFamily: S.grotesk }}>资产设计</h2>
          <p className="text-sm" style={{ color: S.sub }}>人物 · 场景 · 道具 — 统一资产生成工作台</p>
        </div>
      </div>

      {/* 画幅提示 */}
      <div className="flex items-center gap-2 px-3 py-2 rounded" style={{ background: "oklch(0.13 0.005 240)", border: "1px solid oklch(0.20 0.006 240)" }}>
        <span className="text-[10px] px-2 py-0.5 rounded font-bold" style={{ background: "oklch(0.60 0.18 240 / 0.15)", border: "1px solid oklch(0.60 0.18 240 / 0.3)", color: S.blue, fontFamily: S.mono }}>
          {orientation === "portrait" ? "竖屏 9:16" : "横屏 16:9"}
        </span>
        <span className="text-xs" style={{ color: S.dim }}>
          {orientation === "portrait"
            ? "当前项目为竖屏模式：人物资产固定9:16，场景/道具参考图生成竖版构图"
            : "当前项目为横屏模式：人物资产固定9:16，场景/道具参考图生成横版构图"}
        </span>
      </div>

      {/* 选项卡 */}
      <div className="flex gap-1 p-1 rounded-lg" style={{ background: "oklch(0.12 0.005 240)", border: "1px solid oklch(0.20 0.006 240)" }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-md transition-all"
            style={{
              background: activeTab === tab.id ? "oklch(0.18 0.006 240)" : "transparent",
              border: activeTab === tab.id ? `1px solid ${tab.color}55` : "1px solid transparent",
              color: activeTab === tab.id ? tab.color : S.dim,
              fontFamily: S.grotesk,
            }}
          >
            <span style={{ color: activeTab === tab.id ? tab.color : "oklch(0.45 0.008 240)" }}>{tab.icon}</span>
            <span className="text-sm font-semibold">{tab.label}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: activeTab === tab.id ? `${tab.color}22` : "oklch(0.22 0.006 240)", color: activeTab === tab.id ? tab.color : S.dim, fontFamily: S.mono }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── 人物子板块 ── */}
      {activeTab === "character" && (
        <div className="space-y-6">
          <div className="p-3 rounded text-xs" style={{ background: "oklch(0.13 0.005 240)", border: "1px solid oklch(0.20 0.006 240)", color: S.dim }}>
            工作流：<span style={{ color: S.amber }}>STEP 1</span> AI 生成 MJ7 提示词 → 复制到 Midjourney →
            <span style={{ color: S.purple }}> STEP 2</span> 上传 MJ 参考图（9:16）→
            <span style={{ color: S.blue }}> STEP 3</span> 分别生成4张9:16视角图 →
            <span style={{ color: S.green }}> STEP 4</span> 程序拼合为16:9设计主图
          </div>
          {characters.length > 0 && (
            <div className="flex justify-end">
              <Button size="sm" onClick={handleGenerateAll} disabled={generatingAll}
                style={{ background: "oklch(0.75 0.17 65 / 0.15)", border: "1px solid oklch(0.75 0.17 65 / 0.4)", color: S.amber }}>
                {generatingAll ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />生成中...</> : <><Wand2 className="w-3 h-3 mr-1" />一键生成全部 MJ7 提示词</>}
              </Button>
            </div>
          )}
          {characters.length === 0
            ? <div className="p-8 text-center rounded" style={S.card}><p className="text-sm" style={{ color: S.dim }}>请先在阶段一完成剧本解析，系统将自动提取人物信息</p></div>
            : <div className="space-y-6">{characters.map(char => <CharacterCard key={char.id} char={char} />)}</div>
          }
        </div>
      )}

      {/* ── 场景子板块 ── */}
      {activeTab === "scene" && (
        <div className="space-y-6">
          <div className="p-3 rounded text-xs" style={{ background: "oklch(0.13 0.005 240)", border: "1px solid oklch(0.20 0.006 240)", color: S.dim }}>
            工作流：<span style={{ color: S.amber }}>STEP 1</span> AI 生成 MJ7 提示词 → 复制到 Midjourney →
            <span style={{ color: S.purple }}> STEP 2</span> 上传 MJ 参考图 → 生成单张场景参考图（{orientation === "portrait" ? "9:16 竖版" : "16:9 横版"}）
          </div>

          {/* 一键生成按鈕 + 进度显示 */}
          {episodes.length > 0 && (
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                {generatingAllSceneProgress && (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" style={{ color: S.teal }} />
                    <span className="text-xs" style={{ color: S.teal, fontFamily: S.mono }}>
                      正在生成第 {generatingAllSceneProgress.current}/{generatingAllSceneProgress.total} 个场景：{generatingAllSceneProgress.name}
                    </span>
                  </div>
                )}
              </div>
              <Button
                size="sm"
                onClick={handleGenerateAllScenes}
                disabled={generatingAllScenes || totalScenes === 0}
                style={{ background: "oklch(0.65 0.15 185 / 0.15)", border: "1px solid oklch(0.65 0.15 185 / 0.4)", color: S.teal, flexShrink: 0 }}
              >
                {generatingAllScenes
                  ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />生成中…</>
                  : <><Wand2 className="w-3 h-3 mr-1" />一键生成全部场景提示词 ({totalScenes})</>}
              </Button>
            </div>
          )}

          {episodes.length === 0
            ? <div className="p-8 text-center rounded" style={S.card}><p className="text-sm" style={{ color: S.dim }}>请先在阶段一完成剧本解析，系统将自动提取分集信息</p></div>
            : <div className="space-y-6">{episodes.map(ep => <EpisodeSection key={ep.id} episodeId={ep.id} episodeTitle={ep.title || `第 ${ep.number} 集`} type="scene" orientation={orientation} />)}</div>
          }
        </div>
      )}

      {/* ── 道具子板块 ── */}
      {activeTab === "prop" && (
        <div className="space-y-6">
          <div className="p-3 rounded text-xs" style={{ background: "oklch(0.13 0.005 240)", border: "1px solid oklch(0.20 0.006 240)", color: S.dim }}>
            工作流：<span style={{ color: S.amber }}>STEP 1</span> AI 生成 MJ7 提示词 → 复制到 Midjourney →
            <span style={{ color: S.purple }}> STEP 2</span> 上传 MJ 参考图 → 生成单张道具参考图（{orientation === "portrait" ? "9:16 竖版" : "16:9 横版"}）
          </div>
          {episodes.length === 0
            ? <div className="p-8 text-center rounded" style={S.card}><p className="text-sm" style={{ color: S.dim }}>请先在阶段一完成剧本解析，系统将自动提取分集信息</p></div>
            : <div className="space-y-6">{episodes.map(ep => <EpisodeSection key={ep.id} episodeId={ep.id} episodeTitle={ep.title || `第 ${ep.number} 集`} type="prop" orientation={orientation} />)}</div>
          }
        </div>
      )}

      {/* Complete button */}
      <div className="flex justify-end pt-4 border-t" style={{ borderColor: "oklch(0.22 0.006 240)" }}>
        <Button onClick={() => { markPhaseComplete("phase2"); setActivePhase("phase3"); }} className="gap-2"
          style={{ background: "oklch(0.75 0.17 65)", color: "oklch(0.10 0.005 240)", fontWeight: 700 }}>
          资产设计完成，进入分镜设计
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
