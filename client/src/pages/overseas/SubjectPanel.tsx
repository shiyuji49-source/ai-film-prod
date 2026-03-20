import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  X, Upload, Loader2, Sparkles, ZoomIn,
  ImageIcon, Users, MapPin, Package, Maximize2,
  Palette, Grid3X3, ChevronLeft, ChevronRight,
  RefreshCw, Shirt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { STYLE_IMAGE_MODELS, ASPECT_RATIO_OPTIONS, MARKET_OPTIONS } from "@shared/videoModels";

const C = {
  bg: "oklch(0.10 0.005 240)",
  surface: "oklch(0.13 0.006 240)",
  card: "oklch(0.15 0.006 240)",
  border: "oklch(0.20 0.006 240)",
  borderHover: "oklch(0.30 0.01 240)",
  green: "oklch(0.72 0.20 160)",
  greenDim: "oklch(0.72 0.20 160 / 0.15)",
  greenBorder: "oklch(0.72 0.20 160 / 0.5)",
  amber: "oklch(0.75 0.17 65)",
  text: "oklch(0.88 0.005 60)",
  textSub: "oklch(0.70 0.008 240)",
  muted: "oklch(0.50 0.01 240)",
  mutedDim: "oklch(0.25 0.008 240)",
  red: "oklch(0.65 0.22 25)",
  blue: "oklch(0.65 0.15 240)",
};

type OverseasAsset = {
  id: number;
  projectId: number;
  userId: number;
  type: "character" | "scene" | "prop" | "costume";
  name: string;
  description: string | null;
  stylePrompt: string | null;
  styleImageUrl: string | null;
  styleModel: string | null;
  mjPrompt: string | null;
  nbpPrompt: string | null;
  mjImageUrl: string | null;
  mainImageUrl: string | null;
  mainModel: string | null;
  viewFrontUrl: string | null;
  viewSideUrl: string | null;
  viewBackUrl: string | null;
  viewCloseUpUrl: string | null;
  multiAngleGridUrl: string | null;
  referenceImageUrl: string | null;
  resolution: string | null;
  aspectRatio: string | null;
  tags: string | null;
  isGlobalRef: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

type OverseasProject = {
  id: number;
  name: string;
  market: string | null;
  aspectRatio: "landscape" | "portrait";
  style: "realistic" | "animation" | "cg";
  imageEngine: string | null;
  [key: string]: any;
};

type SubjectPanelProps = {
  asset: OverseasAsset;
  project: OverseasProject;
  onClose: () => void;
  onRefresh: () => void;
};

type PanelMode = "style" | "multiview";

// ─── Lightbox ─────────────────────────────────────────────────────────────────
function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "oklch(0.05 0.005 240 / 0.92)",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "zoom-out",
      }}
    >
      <button
        onClick={onClose}
        style={{
          position: "absolute", top: 16, right: 16,
          background: "oklch(0.20 0.006 240)", border: "none",
          borderRadius: 8, padding: 8, cursor: "pointer", color: C.text,
        }}
      >
        <X size={20} />
      </button>
      <img
        src={url}
        alt="preview"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: "90vw", maxHeight: "90vh",
          objectFit: "contain", borderRadius: 8,
          boxShadow: "0 20px 60px oklch(0.0 0 0 / 0.6)",
        }}
      />
    </div>
  );
}

// ─── Clickable Image ──────────────────────────────────────────────────────────
function ClickableImage({ url, alt, height, aspectRatio: ar }: { url: string; alt: string; height?: number; aspectRatio?: string }) {
  const [lightbox, setLightbox] = useState(false);
  return (
    <>
      <div
        onClick={() => setLightbox(true)}
        style={{
          position: "relative", borderRadius: 8, overflow: "hidden",
          border: `1px solid ${C.border}`,
          height: height ?? undefined,
          aspectRatio: ar ?? undefined,
          background: "oklch(0.10 0.005 240)",
          cursor: "zoom-in",
        }}
      >
        <img src={url} alt={alt} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
        <div style={{
          position: "absolute", top: 6, right: 6,
          background: "oklch(0.08 0.005 240 / 0.7)",
          borderRadius: 6, padding: 4,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Maximize2 size={12} style={{ color: C.muted }} />
        </div>
      </div>
      {lightbox && <Lightbox url={url} onClose={() => setLightbox(false)} />}
    </>
  );
}

export function SubjectPanel({ asset, project, onClose, onRefresh }: SubjectPanelProps) {
  const [mode, setMode] = useState<PanelMode>("style");
  const [stylePrompt, setStylePrompt] = useState(asset.stylePrompt ?? asset.mjPrompt ?? "");
  // Default model: for China market use Seedream 4.5, otherwise use project default or MJ
  const getDefaultModel = useCallback(() => {
    const marketDef = MARKET_OPTIONS.find(m => m.value === project.market);
    return asset.styleModel ?? marketDef?.defaultImageEngine ?? project.imageEngine ?? "midjourney";
  }, [asset.styleModel, project.market, project.imageEngine]);
  const [styleModel, setStyleModel] = useState(getDefaultModel);
  const [generating, setGenerating] = useState(false);
  const [generatingMultiView, setGeneratingMultiView] = useState(false);

  const [uploadingRef, setUploadingRef] = useState(false);
  const [resolution, setResolution] = useState(asset.resolution ?? "");
  const defaultAspectRatio = asset.type === "scene" ? "16:9" : (asset.aspectRatio ?? (project.aspectRatio === "portrait" ? "9:16" : "16:9"));
  const [aspectRatio, setAspectRatio] = useState(asset.aspectRatio ?? defaultAspectRatio);
  const refImageInputRef = useRef<HTMLInputElement>(null);

  // History: collect all generated style images (current + previous)
  const styleHistory: string[] = [
    asset.styleImageUrl,
    asset.mjImageUrl,
    asset.mainImageUrl,
  ].filter(Boolean) as string[];

  // (HistoryPaginator is defined at module level below)

  const generateAssetImage = trpc.overseas.generateAssetImage.useMutation({
    onSuccess: () => {
      toast.success("风格参考图生成完成");
      setGenerating(false);
      onRefresh();
    },
    onError: (e) => { toast.error(e.message); setGenerating(false); },
  });

  const generateMultiView = trpc.overseas.generateMultiView.useMutation({
    onSuccess: (data) => {
      toast.success(`多视角生成完成：${data.generated.length} 个视角`);
      setGeneratingMultiView(false);
      onRefresh();
    },
    onError: (e) => { toast.error(e.message); setGeneratingMultiView(false); },
  });

  const generateMjPrompt = trpc.overseas.generateAssetMjPrompt.useMutation({
    onSuccess: (data: { mjPrompt: string }) => {
      setStylePrompt(data.mjPrompt);
      toast.success("提示词已生成");
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const updateAsset = trpc.overseas.updateAsset.useMutation({
    onSuccess: () => { onRefresh(); },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: "mjImageUrl" | "referenceImageUrl") => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingRef(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("assetId", String(asset.id));
    formData.append("projectId", String(asset.projectId ?? 0));
    try {
      const res = await fetch("/api/upload-asset-s3", { method: "POST", body: formData, credentials: "include" });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json() as { url: string };
      updateAsset.mutate({ id: asset.id, [field]: url });
      toast.success("上传成功");
    } catch {
      toast.error("上传失败");
    } finally {
      setUploadingRef(false);
      e.target.value = "";
    }
  };

  const typeIcon = asset.type === "character" ? <Users size={16} style={{ color: C.green }} />
    : asset.type === "scene" ? <MapPin size={16} style={{ color: C.blue }} />
    : asset.type === "costume" ? <Shirt size={16} style={{ color: C.amber }} />
    : <Package size={16} style={{ color: C.amber }} />;

  const typeLabel = asset.type === "character" ? "角色" : asset.type === "scene" ? "场景" : asset.type === "prop" ? "道具" : "服装";

  const hasStyleImage = !!asset.styleImageUrl;
  const hasMultiView = !!(asset.viewFrontUrl || asset.viewSideUrl || asset.viewBackUrl || asset.viewCloseUpUrl || asset.multiAngleGridUrl);

  return (
    <div style={{
      width: 360, background: C.surface, borderLeft: `1px solid ${C.border}`,
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {typeIcon}
          <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{asset.name}</span>
          <span style={{ fontSize: 10, color: C.muted, background: C.card, padding: "1px 6px", borderRadius: 4 }}>{typeLabel}</span>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}>
          <X size={16} />
        </button>
      </div>

      {/* Mode Tabs */}
      <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        {[
          { key: "style" as PanelMode, label: "风格定调", icon: <Palette size={12} />, done: hasStyleImage },
          { key: "multiview" as PanelMode, label: "多视角", icon: <Grid3X3 size={12} />, done: hasMultiView },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setMode(tab.key)}
            style={{
              flex: 1, padding: "8px 0", cursor: "pointer", border: "none",
              fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
              background: mode === tab.key ? C.bg : "transparent",
              color: mode === tab.key ? C.text : C.muted,
              borderBottom: mode === tab.key ? `2px solid ${C.green}` : "2px solid transparent",
              fontWeight: mode === tab.key ? 600 : 400,
              transition: "all 0.15s",
            }}
          >
            {tab.icon} {tab.label}
            {tab.done && <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.green }} />}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
        {mode === "style" && (
          <StylePanel
            asset={asset}
            styleHistory={styleHistory}
            stylePrompt={stylePrompt}
            setStylePrompt={setStylePrompt}
            styleModel={styleModel}
            setStyleModel={setStyleModel}
            resolution={resolution}
            setResolution={setResolution}
            aspectRatio={aspectRatio}
            setAspectRatio={setAspectRatio}
            generating={generating}
            uploadingRef={uploadingRef}
            onGenerate={() => {
              if (!stylePrompt.trim()) { toast.error("请输入提示词"); return; }
              setGenerating(true);
              generateAssetImage.mutate({
                assetId: asset.id,
                projectId: asset.projectId ?? 0,
                viewType: "style",
                imageModel: styleModel,
                customPrompt: stylePrompt,
                resolution,
                aspectRatio,
              });
            }}
            onAutoPrompt={() => {
              generateMjPrompt.mutate({ assetId: asset.id, projectId: asset.projectId ?? 0 });
            }}
            autoPromptLoading={generateMjPrompt.isPending}
            onUploadRef={(e) => handleFileUpload(e, "referenceImageUrl")}
            refImageInputRef={refImageInputRef}
            referenceImageUrl={asset.referenceImageUrl}
          />
        )}

        {mode === "multiview" && (
          <MultiViewPanel
            asset={asset}
            generatingMultiView={generatingMultiView}
            onGenerateMultiView={() => {
              setGeneratingMultiView(true);
              generateMultiView.mutate({ assetId: asset.id, projectId: asset.projectId ?? 0 });
            }}
          />
        )}
      </div>
    </div>
  );
}

// ─── 风格定调面板 ─────────────────────────────────────────────────────────────
function StylePanel({
  asset, styleHistory, stylePrompt, setStylePrompt, styleModel, setStyleModel,
  resolution, setResolution, aspectRatio, setAspectRatio,
  generating, uploadingRef, onGenerate, onAutoPrompt, autoPromptLoading,
  onUploadRef, refImageInputRef, referenceImageUrl,
}: {
  asset: OverseasAsset;
  styleHistory: string[];
  stylePrompt: string;
  setStylePrompt: (v: string) => void;
  styleModel: string;
  setStyleModel: (v: string) => void;
  resolution: string;
  setResolution: (v: string) => void;
  aspectRatio: string;
  setAspectRatio: (v: string) => void;
  generating: boolean;
  uploadingRef: boolean;
  onGenerate: () => void;
  onAutoPrompt: () => void;
  autoPromptLoading: boolean;
  onUploadRef: (e: React.ChangeEvent<HTMLInputElement>) => void;
  refImageInputRef: React.RefObject<HTMLInputElement | null>;
  referenceImageUrl: string | null;
}) {
  return (
    <>
      {/* Description */}
      <div style={{ padding: "8px 10px", borderRadius: 8, background: C.greenDim, border: `1px solid ${C.greenBorder}`, fontSize: 11, color: C.textSub }}>
        <Palette size={12} style={{ color: C.green, display: "inline", marginRight: 4 }} />
        风格定调：使用 MJ / 即梦 4.5 等模型探索视觉风格，确定整体美术方向
      </div>

      {/* Style Image History with pagination */}
      {styleHistory.length > 0 && (
        <HistoryPaginator urls={styleHistory} label={`风格参考${styleHistory.length > 1 ? `（共 ${styleHistory.length} 张）` : ""}`} />
      )}

      {/* Reference Image Upload */}
      <div>
        <label style={{ fontSize: 10, color: C.muted, marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          上传参考图 <span style={{ color: C.mutedDim }}>（可选）</span>
        </label>
        {referenceImageUrl ? (
          <div style={{ position: "relative" }}>
            <ClickableImage url={referenceImageUrl} alt="ref" height={80} />
            <button
              onClick={() => refImageInputRef.current?.click()}
              style={{
                position: "absolute", bottom: 4, right: 4, padding: "3px 8px",
                borderRadius: 4, background: "oklch(0.08 0.005 240 / 0.8)",
                border: "none", color: C.muted, cursor: "pointer", fontSize: 10,
                zIndex: 1,
              }}
            >
              更换
            </button>
          </div>
        ) : (
          <button
            onClick={() => refImageInputRef.current?.click()}
            style={{
              width: "100%", height: 60, borderRadius: 8,
              border: `2px dashed ${C.border}`, background: "transparent",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              color: C.muted, fontSize: 11,
            }}
          >
            {uploadingRef ? <Loader2 size={14} className="animate-spin" /> : <><Upload size={14} /> 上传参考图</>}
          </button>
        )}
        <input ref={refImageInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onUploadRef} />
      </div>

      {/* Image Model Selector */}
      <div>
        <label style={{ fontSize: 10, color: C.muted, marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          图片模型
        </label>
        <select
          value={styleModel}
          onChange={e => setStyleModel(e.target.value)}
          style={{
            width: "100%", padding: "7px 10px",
            background: "oklch(0.15 0.005 240)", border: `1px solid ${C.border}`,
            borderRadius: 6, color: C.text, fontSize: 12,
          }}
        >
          {STYLE_IMAGE_MODELS.map(m => (
            <option key={m.id} value={m.id}>{m.name} ({m.provider})</option>
          ))}
        </select>
        <p style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>
          {styleModel === "doubao-seedream-4-5-251128" ? "💡 即梦 4.5：适合中国市场，真人写实风格" :
           styleModel === "midjourney" ? "💡 MJ：适合海外市场，艺术感强" : ""}
        </p>
      </div>

      {/* Aspect Ratio */}
      <div>
        <label style={{ fontSize: 10, color: C.muted, marginBottom: 4, display: "block" }}>画幅比例</label>
        <select
          value={aspectRatio}
          onChange={e => setAspectRatio(e.target.value)}
          style={{
            width: "100%", padding: "6px 8px",
            background: "oklch(0.15 0.005 240)", border: `1px solid ${C.border}`,
            borderRadius: 6, color: C.text, fontSize: 11,
          }}
        >
          {ASPECT_RATIO_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Prompt */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <label style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>风格提示词</label>
          <button
            onClick={onAutoPrompt}
            disabled={autoPromptLoading}
            style={{ fontSize: 10, color: C.green, cursor: "pointer", background: "none", border: "none", display: "flex", alignItems: "center", gap: 2 }}
          >
            {autoPromptLoading ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />} AI 生成
          </button>
        </div>
        <Textarea
          value={stylePrompt}
          onChange={e => setStylePrompt(e.target.value)}
          placeholder={
            asset.type === "scene"
              ? `描述${asset.name}的场景视觉风格（无人物）...\n例如：Cinematic establishing shot, 16:9, golden hour, no people, no characters...`
              : `描述${asset.name}的视觉风格...\n例如：Cinematic, warm tones, golden hour lighting...`
          }
          rows={5}
          style={{ background: "oklch(0.18 0.006 240)", border: `1px solid ${C.border}`, color: C.text, resize: "none", fontSize: 12 }}
        />
      </div>

      {/* Generate Button */}
      <Button
        onClick={onGenerate}
        disabled={generating || !stylePrompt.trim()}
        style={{ background: C.green, color: "oklch(0.08 0.005 240)", fontWeight: 700, gap: 6 }}
      >
        {generating ? (
          <><Loader2 className="animate-spin w-4 h-4" /> 生成中...</>
        ) : asset.styleImageUrl ? (
          <><RefreshCw size={14} /> 重新生成</>
        ) : (
          <><Palette size={14} /> 生成风格参考图</>
        )}
      </Button>
    </>
  );
}

// ─── 多视角面板 ─────────────────────────────────────────────────────────────
function MultiViewPanel({
  asset, generatingMultiView, onGenerateMultiView,
}: {
  asset: OverseasAsset;
  generatingMultiView: boolean;
  onGenerateMultiView: () => void;
}) {
  const hasRef = !!(asset.mainImageUrl || asset.mjImageUrl || asset.styleImageUrl);

  if (asset.type === "character") {
    const viewHistory = [
      asset.viewCloseUpUrl, asset.viewFrontUrl, asset.viewSideUrl, asset.viewBackUrl,
    ].filter(Boolean) as string[];

    return (
      <>
        <div style={{ padding: "8px 10px", borderRadius: 8, background: C.greenDim, border: `1px solid ${C.greenBorder}`, fontSize: 11, color: C.textSub }}>
          <Grid3X3 size={12} style={{ color: C.green, display: "inline", marginRight: 4 }} />
          角色多视角：近景主视图 + 全身站立三视图（正/侧/背），白色干净背景
        </div>

        {/* View Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <ViewCard label="近景主视图" url={asset.viewCloseUpUrl} />
          <ViewCard label="正面全身" url={asset.viewFrontUrl} />
          <ViewCard label="侧面全身" url={asset.viewSideUrl} />
          <ViewCard label="背面全身" url={asset.viewBackUrl} />
        </div>

        <Button
          onClick={onGenerateMultiView}
          disabled={generatingMultiView || !hasRef}
          style={{ background: C.green, color: "oklch(0.08 0.005 240)", fontWeight: 700, gap: 6 }}
        >
          {generatingMultiView ? (
            <><Loader2 className="animate-spin w-4 h-4" /> 生成中（约1分钟）...</>
          ) : hasRef ? (
            <><RefreshCw size={14} /> {viewHistory.length > 0 ? "重新生成多视角" : "一键生成多视角"}</>
          ) : (
            <><Grid3X3 size={14} /> 一键生成多视角</>
          )}
        </Button>
        {!hasRef && (
          <p style={{ fontSize: 10, color: C.amber, textAlign: "center" }}>请先在「风格定调」中生成风格参考图</p>
        )}
      </>
    );
  }

  if (asset.type === "scene") {
    return (
      <>
        <div style={{ padding: "8px 10px", borderRadius: 8, background: C.greenDim, border: `1px solid ${C.greenBorder}`, fontSize: 11, color: C.textSub }}>
          <Grid3X3 size={12} style={{ color: C.green, display: "inline", marginRight: 4 }} />
          场景多视角：16:9 横屏，多角度九宫格，无人物，展示不同机位和时间段
        </div>

        {asset.multiAngleGridUrl && (
          <ClickableImage url={asset.multiAngleGridUrl} alt="multi-angle" aspectRatio="16/9" />
        )}

        <Button
          onClick={onGenerateMultiView}
          disabled={generatingMultiView || !hasRef}
          style={{ background: C.green, color: "oklch(0.08 0.005 240)", fontWeight: 700, gap: 6 }}
        >
          {generatingMultiView ? (
            <><Loader2 className="animate-spin w-4 h-4" /> 生成中...</>
          ) : (
            <><Grid3X3 size={14} /> {asset.multiAngleGridUrl ? "重新生成" : "生成多角度九宫格"}</>
          )}
        </Button>
        {!hasRef && (
          <p style={{ fontSize: 10, color: C.amber, textAlign: "center" }}>请先在「风格定调」中生成场景参考图</p>
        )}
      </>
    );
  }

  // Prop / Costume
  return (
    <>
      <div style={{ padding: "8px 10px", borderRadius: 8, background: C.greenDim, border: `1px solid ${C.greenBorder}`, fontSize: 11, color: C.textSub }}>
        <Grid3X3 size={12} style={{ color: C.green, display: "inline", marginRight: 4 }} />
        {asset.type === "costume" ? "服装三视图：正面/侧面/背面，白色背景" : "道具三视图：正面/侧面/背面产品照，白色背景"}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <ViewCard label="正面" url={asset.viewFrontUrl} />
        <ViewCard label="侧面" url={asset.viewSideUrl} />
        <ViewCard label="背面" url={asset.viewBackUrl} />
      </div>

      <Button
        onClick={onGenerateMultiView}
        disabled={generatingMultiView || !hasRef}
        style={{ background: C.green, color: "oklch(0.08 0.005 240)", fontWeight: 700, gap: 6 }}
      >
        {generatingMultiView ? (
          <><Loader2 className="animate-spin w-4 h-4" /> 生成中...</>
        ) : (
          <><Grid3X3 size={14} /> {asset.viewFrontUrl ? "重新生成三视图" : "一键生成三视图"}</>
        )}
      </Button>
      {!hasRef && (
        <p style={{ fontSize: 10, color: C.amber, textAlign: "center" }}>请先在「风格定调」中生成参考图</p>
      )}
    </>
  );
}

// ─── History Paginator (defined at module level for reuse) ─────────────────────
function HistoryPaginator({
  urls, label,
}: { urls: string[]; label: string }) {
  const [idx, setIdx] = useState(0);
  if (!urls.length) return null;
  const cur = urls[idx];
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <label style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</label>
        {urls.length > 1 && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button
              onClick={() => setIdx(i => Math.max(0, i - 1))}
              disabled={idx === 0}
              style={{ background: "none", border: "none", cursor: idx === 0 ? "default" : "pointer", color: idx === 0 ? C.mutedDim : C.muted, padding: 2 }}
            >
              <ChevronLeft size={12} />
            </button>
            <span style={{ fontSize: 10, color: C.muted }}>{idx + 1}/{urls.length}</span>
            <button
              onClick={() => setIdx(i => Math.min(urls.length - 1, i + 1))}
              disabled={idx === urls.length - 1}
              style={{ background: "none", border: "none", cursor: idx === urls.length - 1 ? "default" : "pointer", color: idx === urls.length - 1 ? C.mutedDim : C.muted, padding: 2 }}
            >
              <ChevronRight size={12} />
            </button>
          </div>
        )}
      </div>
      <ClickableImage url={cur} alt={label} aspectRatio="16/9" />
    </div>
  );
}

function ViewCard({ label, url }: { label: string; url: string | null }) {
  const [lightbox, setLightbox] = useState(false);
  return (
    <>
      <div
        onClick={() => url && setLightbox(true)}
        style={{
          borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}`,
          background: "oklch(0.12 0.005 240)",
          cursor: url ? "zoom-in" : "default",
        }}
      >
        <div style={{ aspectRatio: "1/1", position: "relative" }}>
          {url ? (
            <>
              <img src={url} alt={label} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
              <div style={{
                position: "absolute", top: 4, right: 4,
                background: "oklch(0.08 0.005 240 / 0.7)",
                borderRadius: 4, padding: 3,
              }}>
                <Maximize2 size={10} style={{ color: C.muted }} />
              </div>
            </>
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ImageIcon size={20} style={{ color: C.mutedDim }} />
            </div>
          )}
        </div>
        <p style={{ fontSize: 10, color: C.muted, textAlign: "center", padding: "4px 0" }}>{label}</p>
      </div>
      {lightbox && url && <Lightbox url={url} onClose={() => setLightbox(false)} />}
    </>
  );
}
