// 视频模型选择器 — 根据模型能力动态显示上传区
import { useState, useRef } from "react";
import { toast } from "sonner";
import { Upload, X, ImageIcon, Users, Info } from "lucide-react";
import { VIDEO_MODELS, getVideoModelCaps, type VideoModelDef } from "@shared/videoModels";

const C = {
  bg: "oklch(0.10 0.005 240)",
  surface: "oklch(0.13 0.006 240)",
  card: "oklch(0.15 0.006 240)",
  border: "oklch(0.20 0.006 240)",
  green: "oklch(0.72 0.20 160)",
  greenDim: "oklch(0.72 0.20 160 / 0.15)",
  greenBorder: "oklch(0.72 0.20 160 / 0.5)",
  amber: "oklch(0.75 0.17 65)",
  text: "oklch(0.88 0.005 60)",
  textSub: "oklch(0.70 0.008 240)",
  muted: "oklch(0.50 0.01 240)",
  mutedDim: "oklch(0.25 0.008 240)",
  blue: "oklch(0.65 0.15 240)",
};

type VideoModelSelectorProps = {
  selectedEngine: string;
  onEngineChange: (engine: string) => void;
  firstFrameUrl?: string | null;
  lastFrameUrl?: string | null;
  subjectRefUrls?: string[];
  onFirstFrameUpload?: (url: string) => void;
  onLastFrameUpload?: (url: string) => void;
  onSubjectRefAdd?: (url: string) => void;
  onSubjectRefRemove?: (index: number) => void;
  /** Available subject assets for quick selection */
  availableSubjects?: Array<{ id: number; name: string; type: string; imageUrl: string | null }>;
};

export function VideoModelSelector({
  selectedEngine,
  onEngineChange,
  firstFrameUrl,
  lastFrameUrl,
  subjectRefUrls = [],
  onFirstFrameUpload,
  onLastFrameUpload,
  onSubjectRefAdd,
  onSubjectRefRemove,
  availableSubjects = [],
}: VideoModelSelectorProps) {
  const caps = getVideoModelCaps(selectedEngine);
  const model = VIDEO_MODELS.find(m => m.id === selectedEngine);

  // Determine mode
  const mode = caps.subjectRef ? "advanced" : caps.lastFrame ? "firstlast" : "basic";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Model Selector */}
      <div>
        <label style={{ fontSize: 10, color: C.muted, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          视频模型
        </label>
        <select
          value={selectedEngine}
          onChange={e => onEngineChange(e.target.value)}
          style={{
            width: "100%", padding: "8px 10px",
            background: "oklch(0.15 0.005 240)", border: `1px solid ${C.border}`,
            borderRadius: 8, color: C.text, fontSize: 12,
          }}
        >
          {VIDEO_MODELS.map(m => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.provider})
            </option>
          ))}
        </select>
      </div>

      {/* Capability Badges */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        <CapBadge active={caps.firstFrame} label="首帧" />
        <CapBadge active={caps.lastFrame} label="尾帧" />
        <CapBadge active={caps.subjectRef} label="主体参考" />
      </div>

      {/* Mode Info */}
      <div style={{
        padding: "8px 10px", borderRadius: 8,
        background: C.greenDim, border: `1px solid ${C.greenBorder}`,
        fontSize: 11, color: C.textSub, display: "flex", alignItems: "flex-start", gap: 6,
      }}>
        <Info size={13} style={{ color: C.green, flexShrink: 0, marginTop: 1 }} />
        <span>
          {mode === "advanced" && "高级模式：支持首帧 + 主体参考图，可上传角色/服装/道具参考"}
          {mode === "firstlast" && "首尾帧模式：支持首帧和尾帧参考图，实现精确运镜控制"}
          {mode === "basic" && "基础模式：仅支持首帧参考图生成视频"}
        </span>
      </div>

      {/* First Frame Upload */}
      <FrameUploadArea
        label="首帧参考图"
        imageUrl={firstFrameUrl}
        onUpload={onFirstFrameUpload}
        required
      />

      {/* Last Frame Upload (if supported) */}
      {caps.lastFrame && (
        <FrameUploadArea
          label="尾帧参考图"
          imageUrl={lastFrameUrl}
          onUpload={onLastFrameUpload}
          hint="可选 — 用于控制视频结束画面"
        />
      )}

      {/* Subject Reference (if supported) */}
      {caps.subjectRef && (
        <div>
          <label style={{ fontSize: 10, color: C.muted, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            主体参考图 <span style={{ color: C.amber }}>（最多 4 张）</span>
          </label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {subjectRefUrls.map((url, i) => (
              <div key={i} style={{ position: "relative", width: 64, height: 64, borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}` }}>
                <img src={url} alt={`ref-${i}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <button
                  onClick={() => onSubjectRefRemove?.(i)}
                  style={{
                    position: "absolute", top: 2, right: 2, width: 18, height: 18, borderRadius: "50%",
                    background: "oklch(0.08 0.005 240 / 0.8)", border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", color: C.muted,
                  }}
                >
                  <X size={10} />
                </button>
              </div>
            ))}
            {subjectRefUrls.length < 4 && (
              <UploadButton onUpload={onSubjectRefAdd} size={64} />
            )}
          </div>
          {/* Quick select from project assets */}
          {availableSubjects.length > 0 && (
            <div>
              <p style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>快速选择项目主体：</p>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {availableSubjects.filter(a => a.imageUrl).slice(0, 6).map(a => (
                  <button
                    key={a.id}
                    onClick={() => {
                      if (subjectRefUrls.length >= 4) { toast.error("最多 4 张参考图"); return; }
                      if (subjectRefUrls.includes(a.imageUrl!)) { toast.info("已添加"); return; }
                      onSubjectRefAdd?.(a.imageUrl!);
                    }}
                    style={{
                      width: 48, height: 48, borderRadius: 6, overflow: "hidden",
                      border: `1px solid ${subjectRefUrls.includes(a.imageUrl!) ? C.green : C.border}`,
                      cursor: "pointer", background: "oklch(0.12 0.005 240)", padding: 0,
                    }}
                    title={a.name}
                  >
                    <img src={a.imageUrl!} alt={a.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CapBadge({ active, label }: { active: boolean; label: string }) {
  return (
    <span style={{
      fontSize: 10, padding: "2px 8px", borderRadius: 4,
      background: active ? C.greenDim : "oklch(0.15 0.005 240)",
      color: active ? C.green : C.mutedDim,
      border: `1px solid ${active ? C.greenBorder : "oklch(0.20 0.006 240)"}`,
    }}>
      {active ? "✓" : "✗"} {label}
    </span>
  );
}

function FrameUploadArea({
  label, imageUrl, onUpload, required, hint,
}: {
  label: string;
  imageUrl?: string | null;
  onUpload?: (url: string) => void;
  required?: boolean;
  hint?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("assetId", "0");
      formData.append("projectId", "0");
      const res = await fetch("/api/upload-asset-s3", { method: "POST", body: formData, credentials: "include" });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json() as { url: string };
      onUpload?.(url);
    } catch (e) {
      toast.error("上传失败");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <label style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {label}
        </label>
        {required && <span style={{ fontSize: 9, color: C.amber }}>必需</span>}
      </div>
      {hint && <p style={{ fontSize: 10, color: C.mutedDim, marginBottom: 6 }}>{hint}</p>}
      {imageUrl ? (
        <div style={{ position: "relative", borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}`, height: 80 }}>
          <img src={imageUrl} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            background: "oklch(0.08 0.005 240 / 0.8)", padding: "4px 8px",
            fontSize: 10, color: C.green,
          }}>
            ✓ 已上传
          </div>
        </div>
      ) : (
        <button
          onClick={() => fileRef.current?.click()}
          style={{
            width: "100%", height: 80, borderRadius: 8,
            border: `2px dashed ${C.border}`, background: "transparent",
            cursor: "pointer", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 4,
            color: C.muted, fontSize: 11, transition: "all 0.15s",
          }}
        >
          {uploading ? (
            <span>上传中...</span>
          ) : (
            <>
              <Upload size={16} />
              <span>点击上传</span>
            </>
          )}
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function UploadButton({ onUpload, size = 64 }: { onUpload?: (url: string) => void; size?: number }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("assetId", "0");
      formData.append("projectId", "0");
      const res = await fetch("/api/upload-asset-s3", { method: "POST", body: formData, credentials: "include" });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json() as { url: string };
      onUpload?.(url);
    } catch (e) {
      toast.error("上传失败");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => fileRef.current?.click()}
        style={{
          width: size, height: size, borderRadius: 8,
          border: `2px dashed ${C.border}`, background: "transparent",
          cursor: "pointer", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 2,
          color: C.muted, fontSize: 9,
        }}
      >
        {uploading ? "..." : <><Upload size={14} /><span>上传</span></>}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
          e.target.value = "";
        }}
      />
    </>
  );
}
