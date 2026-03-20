// 跑量剧工作流 — 三段式界面（剧本 / 主体 / 故事版）
// 参考幻角产品设计，工业暗色调，绿色主题

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import {
  Film, Plus, Trash2, ChevronDown, ChevronUp,
  Wand2, ImageIcon, Video, Upload, Edit3, Check, X,
  Loader2, Globe, ArrowLeft, RefreshCw,
  Copy, Download, Play, AlertCircle, Sparkles, Maximize2,
  Users, MapPin, Package, Zap, MessageSquare, FileText,
  ChevronLeft, ChevronRight, Settings, FileDown, FileUp, Shirt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { SubjectPanel } from "./overseas/SubjectPanel";
import { VideoModelSelector } from "./overseas/VideoModelSelector";
import { LLMChatPanel } from "./overseas/LLMChatPanel";
import { VIDEO_MODELS, IMAGE_MODELS, STYLE_IMAGE_MODELS, MARKET_OPTIONS, getVideoModelName, getImageModelName } from "@shared/videoModels";

// ─── 颜色主题（幻角风格 深色+绿色主题） ──────────────────────────────────────
const C = {
  bg: "oklch(0.10 0.005 240)",
  surface: "oklch(0.13 0.006 240)",
  card: "oklch(0.15 0.006 240)",
  border: "oklch(0.20 0.006 240)",
  borderHover: "oklch(0.30 0.01 240)",
  green: "oklch(0.72 0.20 160)",       // 幻角绿
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

// ─── 类型定义 ─────────────────────────────────────────────────────────────────
type OverseasProject = {
  id: number;
  name: string;
  market: string;
  aspectRatio: "landscape" | "portrait";
  style: "realistic" | "animation" | "cg";
  genre: string;
  totalEpisodes: number | null;
  status: "draft" | "in_progress" | "completed";
  imageEngine: string | null;
  videoEngine: string | null;
  characters: string | null;
  scenes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type OverseasAsset = {
  id: number;
  projectId: number;
  userId: number;
  type: "character" | "scene" | "prop" | "costume";
  name: string;
  description: string | null;
  stylePrompt: string | null;
  referenceImageUrl: string | null;
  mjPrompt: string | null;
  nbpPrompt: string | null;
  mjImageUrl: string | null;
  styleImageUrl: string | null;
  styleModel: string | null;
  mainImageUrl: string | null;
  mainModel: string | null;
  viewFrontUrl: string | null;
  viewSideUrl: string | null;
  viewBackUrl: string | null;
  viewCloseUpUrl: string | null;
  multiAngleGridUrl: string | null;
  resolution: string | null;
  aspectRatio: string | null;
  tags: string | null;
  isGlobalRef: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

type ScriptShot = {
  id: number;
  projectId: number;
  episodeNumber: number;
  shotNumber: number;
  sceneName: string | null;
  shotType: string | null;
  visualDescription: string | null;
  dialogue: string | null;
  characters: string | null;
  emotion: string | null;
  firstFrameUrl: string | null;
  lastFrameUrl: string | null;
  firstFramePrompt: string | null;
  lastFramePrompt: string | null;
  videoUrl: string | null;
  videoPrompt: string | null;
  imageEngine: string | null;
  videoEngine: string | null;
  videoDuration: number | null;
  subjectRefUrls: string | null;
  status: "draft" | "generating_frame" | "frame_done" | "generating_video" | "done" | "failed";
  errorMessage: string | null;
};

type WorkflowTab = "script" | "subject" | "storyboard";
type SubjectFilter = "all" | "character" | "scene" | "prop" | "costume";
type StoryboardPanel = "image" | "video";

// MARKET_OPTIONS is imported from @shared/videoModels

const SHOT_TYPE_COLORS: Record<string, string> = {
  "大特写": "oklch(0.72 0.20 160)",
  "特写": "oklch(0.72 0.20 160)",
  "近景": "oklch(0.65 0.15 200)",
  "中景": "oklch(0.65 0.15 200)",
  "中近景": "oklch(0.65 0.15 200)",
  "全景": "oklch(0.65 0.15 240)",
  "远景": "oklch(0.65 0.15 240)",
  "大远景": "oklch(0.65 0.15 240)",
};

// ─── 主组件 ───────────────────────────────────────────────────────────────────
export default function OverseasWorkflow() {
  const { isAuthenticated, loading } = useAuth();
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);
  const [activeEpisode, setActiveEpisode] = useState(1);
  const [activeTab, setActiveTab] = useState<WorkflowTab>("script");

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg }}>
        <Loader2 className="animate-spin" style={{ color: C.green }} size={32} />
      </div>
    );
  }
  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg }}>
        <div style={{ textAlign: "center" }}>
          <Film size={48} style={{ color: C.muted, marginBottom: 16 }} />
          <p style={{ color: C.textSub, marginBottom: 16 }}>请先登录以使用跑量剧工作流</p>
          <Button onClick={() => window.location.href = getLoginUrl()} style={{ background: C.green, color: "oklch(0.1 0.005 240)" }}>
            登录
          </Button>
        </div>
      </div>
    );
  }

  if (!activeProjectId) {
    return (
      <ProjectDashboard
        onOpenProject={(id) => { setActiveProjectId(id); setActiveTab("script"); setActiveEpisode(1); }}
        onCreateNew={() => {}}
      />
    );
  }

  return (
    <ProjectWorkspace
      projectId={activeProjectId}
      activeEpisode={activeEpisode}
      onEpisodeChange={setActiveEpisode}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onBack={() => setActiveProjectId(null)}
    />
  );
}

// ─── 项目列表 Dashboard ───────────────────────────────────────────────────────
function ProjectDashboard({ onOpenProject, onCreateNew }: { onOpenProject: (id: number) => void; onCreateNew: () => void }) {
  const [showCreate, setShowCreate] = useState(false);
  const { data: projects, refetch } = trpc.overseas.listProjects.useQuery();

  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "32px 40px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <Zap size={20} style={{ color: C.green }} />
            <span style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: "'Space Grotesk', sans-serif" }}>跑量剧</span>
            <span style={{ fontSize: 12, color: C.muted, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em" }}>IMAGE-TO-VIDEO</span>
          </div>
          <p style={{ fontSize: 13, color: C.muted }}>MJ 资产 → Gemini 首帧 → Seedance 视频，全自动批量跑量</p>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          style={{ background: C.green, color: "oklch(0.08 0.005 240)", fontWeight: 700, gap: 6, fontSize: 13 }}
        >
          <Plus size={15} /> 新建项目
        </Button>
      </div>

      {/* Project Grid */}
      {!projects || projects.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 0", border: `1px dashed ${C.border}`, borderRadius: 16 }}>
          <Film size={48} style={{ color: C.mutedDim, margin: "0 auto 16px" }} />
          <p style={{ color: C.muted, marginBottom: 8 }}>还没有跑量剧项目</p>
          <p style={{ fontSize: 12, color: "oklch(0.35 0.008 240)", marginBottom: 20 }}>
            创建项目后，导入剧本，AI 自动拆解分镜，批量生成首帧和视频
          </p>
          <Button onClick={() => setShowCreate(true)} style={{ background: C.green, color: "oklch(0.08 0.005 240)", fontWeight: 700, gap: 6 }}>
            <Plus size={14} /> 创建第一个项目
          </Button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {(projects as OverseasProject[]).map(p => (
            <ProjectCard key={p.id} project={p} onOpen={() => onOpenProject(p.id)} onDelete={() => refetch()} />
          ))}
          <button
            onClick={() => setShowCreate(true)}
            style={{
              border: `2px dashed ${C.border}`, borderRadius: 12, padding: "32px 20px",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
              cursor: "pointer", background: "transparent", color: C.muted,
              transition: "all 0.2s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.green; (e.currentTarget as HTMLButtonElement).style.color = C.green; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.border; (e.currentTarget as HTMLButtonElement).style.color = C.muted; }}
          >
            <Plus size={24} />
            <span style={{ fontSize: 13 }}>新建项目</span>
          </button>
        </div>
      )}

      <CreateProjectDialog open={showCreate} onClose={() => setShowCreate(false)} onCreated={(id) => { setShowCreate(false); onOpenProject(id); }} />
    </div>
  );
}

function ProjectCard({ project, onOpen, onDelete }: { project: OverseasProject; onOpen: () => void; onDelete: () => void }) {
  const deleteProject = trpc.overseas.deleteProject.useMutation({
    onSuccess: () => { toast.success("项目已删除"); onDelete(); },
    onError: (e) => toast.error(e.message),
  });

  const marketLabel = MARKET_OPTIONS.find(m => m.value === project.market)?.label ?? project.market;
  const episodeCount = project.totalEpisodes ?? 20;

  return (
    <div
      style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
        padding: "20px", cursor: "pointer", transition: "all 0.2s",
        position: "relative",
      }}
      onClick={onOpen}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = C.green; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = C.border; }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: C.greenDim, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Film size={18} style={{ color: C.green }} />
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 2 }}>{project.name}</p>
            <p style={{ fontSize: 11, color: C.muted }}>{marketLabel}</p>
          </div>
        </div>
        <button
          onClick={e => { e.stopPropagation(); if (confirm("确认删除此项目？")) deleteProject.mutate({ id: project.id }); }}
          style={{ padding: 4, borderRadius: 6, cursor: "pointer", background: "transparent", color: C.muted, border: "none" }}
        >
          <Trash2 size={14} />
        </button>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: C.greenDim, color: C.green, border: `1px solid ${C.greenBorder}` }}>
          {project.aspectRatio === "portrait" ? "9:16" : "16:9"}
        </span>
        <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: "oklch(0.18 0.006 240)", color: C.textSub }}>
          {episodeCount} 集
        </span>
        <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: "oklch(0.18 0.006 240)", color: C.textSub }}>
          真人写实
        </span>
      </div>
    </div>
  );
}

function CreateProjectDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: number) => void }) {
  const [form, setForm] = useState({ name: "", market: "us", aspectRatio: "portrait" as "portrait" | "landscape", genre: "romance", totalEpisodes: 20 });
  const createProject = trpc.overseas.createProject.useMutation({
    onSuccess: (data) => { toast.success("项目已创建"); onCreated(data.id); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent style={{ background: C.surface, border: `1px solid ${C.border}`, maxWidth: 480 }}>
        <DialogHeader>
          <DialogTitle style={{ color: C.text }}>新建跑量剧项目</DialogTitle>
        </DialogHeader>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "8px 0" }}>
          <div>
            <label style={{ fontSize: 12, color: C.muted, marginBottom: 6, display: "block" }}>项目名称</label>
            <Input
              placeholder="例：荒野12 · 第一季"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              style={{ background: "oklch(0.18 0.006 240)", border: `1px solid ${C.border}`, color: C.text }}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: C.muted, marginBottom: 6, display: "block" }}>目标市场</label>
              <Select value={form.market} onValueChange={v => setForm(f => ({ ...f, market: v }))}>
                <SelectTrigger style={{ background: "oklch(0.18 0.006 240)", border: `1px solid ${C.border}`, color: C.text }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                  {MARKET_OPTIONS.map(m => <SelectItem key={m.value} value={m.value} style={{ color: C.text }}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: C.muted, marginBottom: 6, display: "block" }}>画幅</label>
              <Select value={form.aspectRatio} onValueChange={v => setForm(f => ({ ...f, aspectRatio: v as "portrait" | "landscape" }))}>
                <SelectTrigger style={{ background: "oklch(0.18 0.006 240)", border: `1px solid ${C.border}`, color: C.text }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                  <SelectItem value="portrait" style={{ color: C.text }}>竖屏 9:16</SelectItem>
                  <SelectItem value="landscape" style={{ color: C.text }}>横屏 16:9</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, color: C.muted, marginBottom: 6, display: "block" }}>总集数</label>
            <Input
              type="number" min={1} max={100} value={form.totalEpisodes}
              onChange={e => setForm(f => ({ ...f, totalEpisodes: parseInt(e.target.value) || 20 }))}
              style={{ background: "oklch(0.18 0.006 240)", border: `1px solid ${C.border}`, color: C.text }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} style={{ borderColor: C.border, color: C.muted }}>取消</Button>
          <Button
            onClick={() => createProject.mutate({ name: form.name, market: form.market, aspectRatio: form.aspectRatio, style: "realistic", genre: form.genre, totalEpisodes: form.totalEpisodes })}
            disabled={!form.name.trim() || createProject.isPending}
            style={{ background: C.green, color: "oklch(0.08 0.005 240)", fontWeight: 700 }}
          >
            {createProject.isPending ? <Loader2 className="animate-spin w-4 h-4" /> : "创建项目"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── 项目工作区（三段式导航） ──────────────────────────────────────────────────
function ProjectWorkspace({
  projectId, activeEpisode, onEpisodeChange, activeTab, onTabChange, onBack
}: {
  projectId: number;
  activeEpisode: number;
  onEpisodeChange: (ep: number) => void;
  activeTab: WorkflowTab;
  onTabChange: (tab: WorkflowTab) => void;
  onBack: () => void;
}) {
  const { data } = trpc.overseas.getProject.useQuery({ id: projectId });
  const project = data?.project as OverseasProject | undefined;

  if (!project) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 className="animate-spin" style={{ color: C.green }} size={32} />
      </div>
    );
  }

  const tabs: { key: WorkflowTab; label: string }[] = [
    { key: "script", label: "剧本" },
    { key: "subject", label: "主体" },
    { key: "storyboard", label: "故事版" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column" }}>
      {/* Top Bar */}
      <div style={{
        height: 52, display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 20px", borderBottom: `1px solid ${C.border}`,
        background: C.surface, flexShrink: 0,
      }}>
        {/* Left: Back + Project Name */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={onBack}
            style={{ display: "flex", alignItems: "center", gap: 4, color: C.muted, cursor: "pointer", background: "none", border: "none", fontSize: 12, padding: "4px 8px", borderRadius: 6 }}
          >
            <ChevronLeft size={14} /> 返回
          </button>
          <span style={{ color: C.border }}>|</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{project.name}</span>
          <span style={{ fontSize: 11, color: C.muted, fontFamily: "'JetBrains Mono', monospace" }}>
            {MARKET_OPTIONS.find(m => m.value === project.market)?.label}
          </span>
        </div>

        {/* Center: Tab Navigation */}
        <div style={{ display: "flex", gap: 2, background: "oklch(0.10 0.005 240)", borderRadius: 8, padding: 3 }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              style={{
                padding: "5px 20px", borderRadius: 6, cursor: "pointer", border: "none",
                fontSize: 13, fontWeight: 500, transition: "all 0.15s",
                background: activeTab === tab.key ? C.green : "transparent",
                color: activeTab === tab.key ? "oklch(0.08 0.005 240)" : C.muted,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Right: Actions */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={async () => {
              try {
                toast.info("正在导出...");
                const res = await fetch("/api/trpc/overseas.exportShotsExcel", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ json: { projectId } }),
                });
                const data = await res.json() as any;
                const csvContent = data?.result?.data?.json?.csvContent;
                if (csvContent) {
                  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${project.name}_分镜表.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success("导出成功");
                } else {
                  toast.error("导出失败");
                }
              } catch (e) { toast.error("导出失败"); }
            }}
            style={{ display: "flex", alignItems: "center", gap: 4, color: C.muted, cursor: "pointer", background: "none", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, padding: "4px 10px" }}
          >
            <FileDown size={12} /> 导出 Excel
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        <AnimatePresence mode="wait">
          {activeTab === "script" && (
            <motion.div key="script" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} style={{ height: "100%" }}>
              <ScriptTab projectId={projectId} project={project} activeEpisode={activeEpisode} onEpisodeChange={onEpisodeChange} />
            </motion.div>
          )}
          {activeTab === "subject" && (
            <motion.div key="subject" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} style={{ height: "100%" }}>
              <SubjectTab projectId={projectId} project={project} />
            </motion.div>
          )}
          {activeTab === "storyboard" && (
            <motion.div key="storyboard" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} style={{ height: "100%", overflow: "hidden" }}>
              <StoryboardTab projectId={projectId} project={project} activeEpisode={activeEpisode} onEpisodeChange={onEpisodeChange} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* LLM Chat Panel */}
      <LLMChatPanel projectId={projectId} context={`项目：${project.name}，市场：${project.market}，风格：${project.style}`} />
    </div>
  );
}

// ─── 剧本 Tab ─────────────────────────────────────────────────────────────────
function ScriptTab({ projectId, project, activeEpisode, onEpisodeChange }: {
  projectId: number;
  project: OverseasProject;
  activeEpisode: number;
  onEpisodeChange: (ep: number) => void;
}) {
  const [showScriptInput, setShowScriptInput] = useState(false);
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [scriptText, setScriptText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [selectedShotIds, setSelectedShotIds] = useState<Set<number>>(new Set());
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
  // Batch import state
  const [batchScripts, setBatchScripts] = useState<Array<{ episodeNumber: number; scriptText: string }>>([]);
  const [batchImporting, setBatchImporting] = useState(false);
  const [batchResults, setBatchResults] = useState<Array<{ episodeNumber: number; shotCount: number; error?: string }> | null>(null);
  // File upload state
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [batchInputMode, setBatchInputMode] = useState<"file" | "text">("file");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalEpisodes = project.totalEpisodes ?? 20;
  const { data: shotsData, refetch } = trpc.overseas.listShots.useQuery({ projectId, episodeNumber: activeEpisode });
  const shots = (shotsData ?? []) as ScriptShot[];

  const parseScript = trpc.overseas.parseScript.useMutation({
    onSuccess: () => { toast.success("分镜拆解完成"); setShowScriptInput(false); setScriptText(""); setGenerating(false); refetch(); },
    onError: (e: { message: string }) => { toast.error(e.message); setGenerating(false); },
  });

  const batchParseScripts = trpc.overseas.batchParseScripts.useMutation({
    onSuccess: (data) => {
      setBatchImporting(false);
      setBatchResults(data.results);
      const successCount = data.results.filter(r => r.shotCount > 0).length;
      toast.success(`批量导入完成：${successCount}/${data.totalEpisodes} 集成功`);
      refetch();
    },
    onError: (e) => { toast.error(e.message); setBatchImporting(false); },
  });

  const deleteShot = trpc.overseas.deleteShot.useMutation({
    onSuccess: () => { toast.success("已删除"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const handleGenerate = () => {
    if (!scriptText.trim()) { toast.error("请输入剧本内容"); return; }
    setGenerating(true);
    parseScript.mutate({ projectId, episodeNumber: activeEpisode, scriptText });
  };

  // Parse batch text: split by episode markers like "第X集" or "Episode X" or "EP X" or "---"
  const parseBatchText = (text: string) => {
    const lines = text.split("\n");
    const episodes: Array<{ episodeNumber: number; scriptText: string }> = [];
    let currentEp = -1;
    let currentLines: string[] = [];

    for (const line of lines) {
      const epMatch = line.match(/^(?:第\s*(\d+)\s*集|Episode\s*(\d+)|EP\s*(\d+)|#{1,3}\s*(?:第\s*)?(\d+)(?:\s*集)?)/i);
      if (epMatch) {
        if (currentEp > 0 && currentLines.length > 0) {
          episodes.push({ episodeNumber: currentEp, scriptText: currentLines.join("\n").trim() });
        }
        currentEp = parseInt(epMatch[1] || epMatch[2] || epMatch[3] || epMatch[4]);
        currentLines = [];
      } else {
        currentLines.push(line);
      }
    }
    if (currentEp > 0 && currentLines.length > 0) {
      episodes.push({ episodeNumber: currentEp, scriptText: currentLines.join("\n").trim() });
    }
    return episodes;
  };

  const handleFileUpload = async (file: File) => {
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (!["xlsx", "xls", "docx", "doc", "txt"].includes(ext)) {
      toast.error("不支持的文件格式，请上传 .xlsx / .docx / .txt 文件");
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      toast.error("文件过大，请上传 30MB 以内的文件");
      return;
    }
    setUploadingFile(true);
    setUploadedFileName("");
    setBatchScripts([]);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const resp = await fetch("/api/upload-script", { method: "POST", body: formData });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "解析失败");
      const episodes: Array<{ episodeNumber: number; scriptText: string }> = data.episodes || [];
      if (episodes.length === 0) {
        toast.error("未识别到任何集数，请检查文件格式");
      } else {
        setBatchScripts(episodes);
        setUploadedFileName(file.name);
        toast.success(`文件解析成功，识别到 ${episodes.length} 集`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "文件解析失败");
    } finally {
      setUploadingFile(false);
    }
  };

  const handleBatchImport = () => {
    if (batchScripts.length === 0) { toast.error("未识别到任何集数，请检查格式"); return; }
    setBatchImporting(true);
    batchParseScripts.mutate({ projectId, scripts: batchScripts });
  };

  const toggleSelect = (id: number) => {
    setSelectedShotIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedShotIds(new Set(shots.map(s => s.id)));
  const clearSelect = () => setSelectedShotIds(new Set());

  return (
    <div style={{ display: "flex", height: "calc(100vh - 52px)", overflow: "hidden" }}>
      {/* Episode Sidebar */}
      <div style={{
        width: 64, background: C.surface, borderRight: `1px solid ${C.border}`,
        display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 0", gap: 4,
        overflowY: "auto", flexShrink: 0,
      }}>
        <span style={{ fontSize: 9, color: C.muted, letterSpacing: "0.05em", marginBottom: 4, textTransform: "uppercase" }}>集</span>
        {Array.from({ length: totalEpisodes }, (_, i) => i + 1).map(ep => (
          <button
            key={ep}
            onClick={() => onEpisodeChange(ep)}
            style={{
              width: 40, height: 32, borderRadius: 6, cursor: "pointer", border: "none",
              background: activeEpisode === ep ? C.green : "transparent",
              color: activeEpisode === ep ? "oklch(0.08 0.005 240)" : C.muted,
              fontSize: 12, fontWeight: activeEpisode === ep ? 700 : 400,
              transition: "all 0.15s",
            }}
          >
            {ep}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {/* Toolbar */}
        <div style={{
          padding: "10px 20px", borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: C.surface, flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>第 {activeEpisode} 集</span>
            <span style={{ fontSize: 11, color: C.muted }}>共 {shots.length} 个镜头</span>
            {selectedShotIds.size > 0 && (
              <span style={{ fontSize: 11, color: C.green }}>已选 {selectedShotIds.size} 个</span>
            )}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {shots.length > 0 && selectedShotIds.size === 0 && (
              <button onClick={selectAll} style={{ fontSize: 11, color: C.muted, cursor: "pointer", background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 10px" }}>
                全选
              </button>
            )}
            {selectedShotIds.size > 0 && (
              <button onClick={clearSelect} style={{ fontSize: 11, color: C.muted, cursor: "pointer", background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 10px" }}>
                取消选择
              </button>
            )}
            <Button
              onClick={() => setShowScriptInput(true)}
              style={{ background: C.green, color: "oklch(0.08 0.005 240)", fontWeight: 700, fontSize: 12, gap: 5, height: 32 }}
            >
              <Wand2 size={13} /> {shots.length > 0 ? "重新生成" : "导入剧本"}
            </Button>
            <Button
              onClick={() => setShowBatchImport(true)}
              variant="outline"
              style={{ borderColor: C.greenBorder, color: C.green, fontWeight: 600, fontSize: 12, gap: 5, height: 32 }}
            >
              <FileUp size={13} /> 批量导入全集
            </Button>
          </div>
        </div>

        {/* Shot List */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {shots.length === 0 && !showScriptInput ? (
            <div style={{ textAlign: "center", padding: "60px 0", border: `1px dashed ${C.border}`, borderRadius: 12 }}>
              <FileText size={40} style={{ color: C.mutedDim, margin: "0 auto 12px" }} />
              <p style={{ color: C.muted, marginBottom: 6 }}>第 {activeEpisode} 集还没有分镜</p>
              <p style={{ fontSize: 12, color: "oklch(0.35 0.008 240)", marginBottom: 20 }}>
                导入剧本后，AI 自动拆解为分镜文字描述（每集 20-30 个镜头）
              </p>
              <Button onClick={() => setShowScriptInput(true)} style={{ background: C.green, color: "oklch(0.08 0.005 240)", fontWeight: 700, gap: 6 }}>
                <Upload size={14} /> 导入第 {activeEpisode} 集剧本
              </Button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {shots.map(shot => (
                <ScriptShotCard
                  key={shot.id}
                  shot={shot}
                  selected={selectedShotIds.has(shot.id)}
                  onToggleSelect={() => toggleSelect(shot.id)}
                  onDelete={() => deleteShot.mutate({ id: shot.id })}
                />
              ))}
            </div>
          )}
        </div>

        {/* Bottom Actions */}
        {shots.length > 0 && (
          <div style={{
            padding: "12px 20px", borderTop: `1px solid ${C.border}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: C.surface, flexShrink: 0,
          }}>
            <div style={{ display: "flex", gap: 8 }}>
              <Button
                variant="outline"
                onClick={() => setShowScriptInput(true)}
                style={{ fontSize: 12, borderColor: C.border, color: C.muted, height: 32, gap: 5 }}
              >
                <RefreshCw size={12} /> 重新生成
              </Button>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Button
                style={{ background: C.green, color: "oklch(0.08 0.005 240)", fontWeight: 700, fontSize: 12, gap: 5, height: 32 }}
                onClick={() => toast.info("请切换到「主体」Tab 管理角色/场景资产")}
              >
                下一步：主体 →
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Script Input Dialog - Fixed Size */}
      <Dialog open={showScriptInput} onOpenChange={setShowScriptInput}>
        <DialogContent style={{ background: C.surface, border: `1px solid ${C.border}`, maxWidth: 680, width: 680, maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
          <DialogHeader style={{ flexShrink: 0 }}>
            <DialogTitle style={{ color: C.text }}>导入第 {activeEpisode} 集剧本</DialogTitle>
          </DialogHeader>
          <div style={{ padding: "8px 0", flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <p style={{ fontSize: 12, color: C.muted, marginBottom: 10, flexShrink: 0 }}>
              粘贴剧本内容，AI 将自动拆解为分镜（每集 20-30 个镜头），严格按原剧本内容生成，不会添加原剧本没有的内容。
            </p>
            <Textarea
              value={scriptText}
              onChange={e => setScriptText(e.target.value)}
              placeholder={`第${activeEpisode}集剧本内容...\n\n场景1：...\n人物对白：...\n动作描述：...`}
              style={{ background: "oklch(0.18 0.006 240)", border: `1px solid ${C.border}`, color: C.text, resize: "none", fontSize: 13, height: 320, minHeight: 320, maxHeight: 320 }}
            />
            <p style={{ fontSize: 11, color: C.muted, marginTop: 6, flexShrink: 0 }}>字数：{scriptText.length}</p>
          </div>
          <DialogFooter style={{ flexShrink: 0 }}>
            <Button variant="outline" onClick={() => setShowScriptInput(false)} style={{ borderColor: C.border, color: C.muted }}>取消</Button>
            <Button
              onClick={handleGenerate}
              disabled={!scriptText.trim() || generating}
              style={{ background: C.green, color: "oklch(0.08 0.005 240)", fontWeight: 700, gap: 6 }}
            >
              {generating ? <><Loader2 className="animate-spin w-4 h-4" /> AI 拆解中...</> : <><Wand2 size={14} /> 开始拆解</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Import Dialog - Enhanced with File Upload */}
      <Dialog open={showBatchImport} onOpenChange={(open) => { setShowBatchImport(open); if (!open) { setBatchResults(null); setBatchScripts([]); setUploadedFileName(""); setBatchInputMode("file"); } }}>
        <DialogContent style={{ background: C.surface, border: `1px solid ${C.border}`, maxWidth: 820, width: 820, maxHeight: "88vh", display: "flex", flexDirection: "column" }}>
          <DialogHeader style={{ flexShrink: 0 }}>
            <DialogTitle style={{ color: C.text, display: "flex", alignItems: "center", gap: 10 }}>
              批量导入全集剧本
            </DialogTitle>
          </DialogHeader>
          <div style={{ padding: "8px 0", flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {/* Mode Toggle */}
            <div style={{ display: "flex", gap: 4, marginBottom: 12, background: "oklch(0.12 0.005 240)", borderRadius: 8, padding: 3, flexShrink: 0 }}>
              <button
                onClick={() => setBatchInputMode("file")}
                style={{
                  flex: 1, padding: "7px 0", borderRadius: 6, border: "none", cursor: "pointer",
                  fontSize: 12, fontWeight: 600, transition: "all 0.15s",
                  background: batchInputMode === "file" ? C.green : "transparent",
                  color: batchInputMode === "file" ? "oklch(0.08 0.005 240)" : C.muted,
                }}
              >
                <FileUp size={12} style={{ display: "inline", verticalAlign: -2, marginRight: 4 }} />
                上传文件（Excel / Word / TXT）
              </button>
              <button
                onClick={() => setBatchInputMode("text")}
                style={{
                  flex: 1, padding: "7px 0", borderRadius: 6, border: "none", cursor: "pointer",
                  fontSize: 12, fontWeight: 600, transition: "all 0.15s",
                  background: batchInputMode === "text" ? C.green : "transparent",
                  color: batchInputMode === "text" ? "oklch(0.08 0.005 240)" : C.muted,
                }}
              >
                <Edit3 size={12} style={{ display: "inline", verticalAlign: -2, marginRight: 4 }} />
                粘贴文本
              </button>
            </div>

            {batchInputMode === "file" ? (
              /* ─── File Upload Mode ─── */
              <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1, overflow: "hidden" }}>
                {/* Drop Zone */}
                <div
                  onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={async e => {
                    e.preventDefault(); setIsDragging(false);
                    const file = e.dataTransfer.files[0];
                    if (file) await handleFileUpload(file);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${isDragging ? C.green : C.border}`,
                    borderRadius: 12, padding: "36px 20px", textAlign: "center", cursor: "pointer",
                    background: isDragging ? "oklch(0.55 0.18 160 / 0.05)" : "oklch(0.12 0.005 240)",
                    transition: "all 0.2s", flexShrink: 0,
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.docx,.doc,.txt"
                    style={{ display: "none" }}
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      if (file) await handleFileUpload(file);
                      e.target.value = "";
                    }}
                  />
                  {uploadingFile ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                      <Loader2 size={28} className="animate-spin" style={{ color: C.green }} />
                      <p style={{ fontSize: 13, color: C.text }}>正在解析文件...</p>
                    </div>
                  ) : uploadedFileName ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                      <Check size={28} style={{ color: C.green }} />
                      <p style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{uploadedFileName}</p>
                      <p style={{ fontSize: 11, color: C.green }}>已识别 {batchScripts.length} 集</p>
                      <p style={{ fontSize: 11, color: C.muted }}>点击重新上传</p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                      <Upload size={28} style={{ color: C.muted }} />
                      <p style={{ fontSize: 13, color: C.text }}>拖拽文件到此处，或点击选择文件</p>
                      <p style={{ fontSize: 11, color: C.muted }}>支持 .xlsx / .docx / .txt 格式，最大 30MB</p>
                      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                        {["Excel (.xlsx)", "Word (.docx)", "文本 (.txt)"].map(f => (
                          <span key={f} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "oklch(0.18 0.006 240)", color: C.muted, border: `1px solid ${C.border}` }}>{f}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Format Tips */}
                <div style={{ fontSize: 11, color: C.muted, padding: "8px 12px", background: "oklch(0.12 0.005 240)", borderRadius: 8, border: `1px solid ${C.border}`, flexShrink: 0 }}>
                  <p style={{ fontWeight: 600, marginBottom: 4, color: C.text }}>格式说明</p>
                  <p><strong>Excel：</strong>每个 Sheet 为一集（Sheet 名如「第1集」「EP1」「1」），或单 Sheet 中用「第X集」分隔</p>
                  <p><strong>Word：</strong>用「第X集」或「Episode X」或「EP X」标题分隔各集</p>
                  <p><strong>TXT：</strong>同 Word，用集数标记分隔</p>
                </div>

                {/* Episode Preview */}
                {batchScripts.length > 0 && (
                  <div style={{ flex: 1, overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 8, background: "oklch(0.12 0.005 240)" }}>
                    <div style={{ padding: "8px 12px", borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, background: "oklch(0.14 0.005 240)", zIndex: 1 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: C.text }}>解析预览 — 共 {batchScripts.length} 集</span>
                    </div>
                    {batchScripts.map(ep => (
                      <div key={ep.episodeNumber} style={{ padding: "8px 12px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <span style={{
                          minWidth: 48, height: 22, borderRadius: 5, background: C.greenDim,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 11, fontWeight: 700, color: C.green, border: `1px solid ${C.greenBorder}`,
                          flexShrink: 0, marginTop: 1,
                        }}>
                          第{ep.episodeNumber}集
                        </span>
                        <p style={{ fontSize: 11, color: C.muted, lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
                          {ep.scriptText.slice(0, 200)}{ep.scriptText.length > 200 ? "..." : ""}
                        </p>
                        <span style={{ fontSize: 10, color: "oklch(0.40 0.008 240)", flexShrink: 0, marginTop: 2 }}>
                          {ep.scriptText.length} 字
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* ─── Text Paste Mode (original) ─── */
              <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
                <p style={{ fontSize: 12, color: C.muted, marginBottom: 10, flexShrink: 0 }}>
                  粘贴所有集数的剧本，用 <code style={{ background: "oklch(0.18 0.006 240)", padding: "1px 4px", borderRadius: 3 }}>第X集</code> 或 <code style={{ background: "oklch(0.18 0.006 240)", padding: "1px 4px", borderRadius: 3 }}>Episode X</code> 或 <code style={{ background: "oklch(0.18 0.006 240)", padding: "1px 4px", borderRadius: 3 }}>EP X</code> 分隔各集。
                </p>
                <Textarea
                  onChange={e => {
                    const parsed = parseBatchText(e.target.value);
                    setBatchScripts(parsed);
                  }}
                  placeholder={`第1集\n场景1：...\n人物对白：...\n\n第2集\n场景1：...\n\n第3集\n...`}
                  style={{ background: "oklch(0.18 0.006 240)", border: `1px solid ${C.border}`, color: C.text, resize: "none", fontSize: 13, height: 300, minHeight: 300, maxHeight: 300 }}
                />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, flexShrink: 0 }}>
                  <p style={{ fontSize: 11, color: batchScripts.length > 0 ? C.green : C.muted }}>
                    {batchScripts.length > 0
                      ? `已识别 ${batchScripts.length} 集：${batchScripts.map(s => `第${s.episodeNumber}集`).join("、")}`
                      : "粘贴剧本后自动识别集数"}
                  </p>
                </div>
              </div>
            )}

            {/* Batch Results */}
            {batchResults && (
              <div style={{ marginTop: 12, padding: 12, background: "oklch(0.12 0.005 240)", borderRadius: 8, border: `1px solid ${C.border}`, maxHeight: 160, overflowY: "auto", flexShrink: 0 }}>
                <p style={{ fontSize: 11, color: C.text, fontWeight: 600, marginBottom: 8 }}>导入结果：</p>
                {batchResults.map(r => (
                  <div key={r.episodeNumber} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0", fontSize: 12 }}>
                    <span style={{ color: C.muted, width: 60 }}>第 {r.episodeNumber} 集</span>
                    {r.error ? (
                      <span style={{ color: C.red }}>{r.error}</span>
                    ) : (
                      <span style={{ color: C.green }}>{r.shotCount} 个镜头</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter style={{ flexShrink: 0 }}>
            <Button variant="outline" onClick={() => { setShowBatchImport(false); setBatchResults(null); setBatchScripts([]); setUploadedFileName(""); }} style={{ borderColor: C.border, color: C.muted }}>关闭</Button>
            <Button
              onClick={handleBatchImport}
              disabled={batchScripts.length === 0 || batchImporting}
              style={{ background: C.green, color: "oklch(0.08 0.005 240)", fontWeight: 700, gap: 6 }}
            >
              {batchImporting ? <><Loader2 className="animate-spin w-4 h-4" /> 批量拆解中（{batchScripts.length}集）...</> : <><Wand2 size={14} /> 批量拆解 {batchScripts.length} 集</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── 分镜卡片（剧本 Tab） ─────────────────────────────────────────────────────
function ScriptShotCard({ shot, selected, onToggleSelect, onDelete }: {
  shot: ScriptShot;
  selected: boolean;
  onToggleSelect: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const shotTypes = shot.shotType ? shot.shotType.split(/[,，、\s]+/).filter(Boolean) : [];
  const characters = shot.characters ? shot.characters.split(/[,，、\s]+/).filter(Boolean) : [];

  return (
    <div style={{
      background: C.card, border: `1px solid ${selected ? C.green : C.border}`,
      borderRadius: 10, overflow: "hidden", transition: "border-color 0.15s",
    }}>
      {/* Card Header */}
      <div
        style={{ padding: "12px 16px", display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Select checkbox */}
        <button
          onClick={e => { e.stopPropagation(); onToggleSelect(); }}
          style={{
            width: 18, height: 18, borderRadius: 4, border: `2px solid ${selected ? C.green : C.border}`,
            background: selected ? C.green : "transparent", cursor: "pointer", flexShrink: 0, marginTop: 2,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {selected && <Check size={11} style={{ color: "oklch(0.08 0.005 240)" }} />}
        </button>

        {/* Shot Number */}
        <div style={{
          minWidth: 40, height: 24, borderRadius: 6, background: C.green,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 700, color: "oklch(0.08 0.005 240)",
          fontFamily: "'JetBrains Mono', monospace", flexShrink: 0,
        }}>
          {shot.episodeNumber}.{shot.shotNumber}
        </div>

        {/* Shot Type Tags */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", flex: 1 }}>
          {shotTypes.map((t, i) => (
            <span key={i} style={{
              fontSize: 11, padding: "2px 8px", borderRadius: 4,
              background: `${SHOT_TYPE_COLORS[t] ?? C.blue}20`,
              color: SHOT_TYPE_COLORS[t] ?? C.blue,
              border: `1px solid ${SHOT_TYPE_COLORS[t] ?? C.blue}50`,
            }}>
              {t}
            </span>
          ))}
          {shot.sceneName && (
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "oklch(0.20 0.006 240)", color: C.muted }}>
              {shot.sceneName}
            </span>
          )}
        </div>

        {/* Characters */}
        {characters.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            {characters.map((c, i) => (
              <span key={i} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: C.greenDim, color: C.green, border: `1px solid ${C.greenBorder}` }}>
                {c}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <button
            onClick={e => { e.stopPropagation(); if (confirm("确认删除此镜头？")) onDelete(); }}
            style={{ padding: 4, borderRadius: 4, cursor: "pointer", background: "transparent", color: C.muted, border: "none" }}
          >
            <Trash2 size={13} />
          </button>
          {expanded ? <ChevronUp size={14} style={{ color: C.muted }} /> : <ChevronDown size={14} style={{ color: C.muted }} />}
        </div>
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ borderTop: `1px solid ${C.border}`, padding: "14px 16px 14px 46px", display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Scene Description */}
              {shot.visualDescription && (
                <div>
                  <label style={{ fontSize: 10, color: C.muted, marginBottom: 4, display: "block", letterSpacing: "0.06em", textTransform: "uppercase" }}>场景描述</label>
                  <p style={{ fontSize: 12, color: C.textSub, lineHeight: 1.7 }}>{shot.visualDescription}</p>
                </div>
              )}
              {/* Dialogue */}
              {shot.dialogue && (
                <div>
                  <label style={{ fontSize: 10, color: C.muted, marginBottom: 4, display: "block", letterSpacing: "0.06em", textTransform: "uppercase" }}>对白</label>
                  <p style={{ fontSize: 12, color: "oklch(0.78 0.01 240)", lineHeight: 1.7, fontStyle: "italic" }}>"{shot.dialogue}"</p>
                </div>
              )}
              {/* Emotion */}
              {shot.emotion && (
                <div>
                  <label style={{ fontSize: 10, color: C.muted, marginBottom: 4, display: "block", letterSpacing: "0.06em", textTransform: "uppercase" }}>情绪/氛围</label>
                  <p style={{ fontSize: 12, color: C.textSub }}>{shot.emotion}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── 主体 Tab ─────────────────────────────────────────────────────────────────
function SubjectTab({ projectId, project }: { projectId: number; project: OverseasProject }) {
  const [filter, setFilter] = useState<SubjectFilter>("all");
  const [selectedAsset, setSelectedAsset] = useState<OverseasAsset | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addType, setAddType] = useState<"character" | "scene" | "prop" | "costume">("character");
  const [detectingAssets, setDetectingAssets] = useState(false);
  const [generatingPrompts, setGeneratingPrompts] = useState(false);
  const [promptProgress, setPromptProgress] = useState<{ current: number; total: number } | null>(null);
  const stopGeneratingPromptsRef = useRef(false);
  const { data: charAssets, refetch: refetchChar } = trpc.overseas.listAssets.useQuery({ projectId, type: "character" });
  const { data: sceneAssets, refetch: refetchScene } = trpc.overseas.listAssets.useQuery({ projectId, type: "scene" });
  const { data: propAssets, refetch: refetchProp } = trpc.overseas.listAssets.useQuery({ projectId, type: "prop" });
  const { data: costumeAssets, refetch: refetchCostume } = trpc.overseas.listAssets.useQuery({ projectId, type: "costume" });
  const allAssets = [
    ...(charAssets ?? []).map(a => ({ ...a, _type: "character" as const })),
    ...(sceneAssets ?? []).map(a => ({ ...a, _type: "scene" as const })),
    ...(propAssets ?? []).map(a => ({ ...a, _type: "prop" as const })),
    ...(costumeAssets ?? []).map(a => ({ ...a, _type: "costume" as const })),
  ] as (OverseasAsset & { _type: "character" | "scene" | "prop" | "costume" })[];
  const filtered = filter === "all" ? allAssets : allAssets.filter(a => a._type === filter);
  const refetchAll = () => { refetchChar(); refetchScene(); refetchProp(); refetchCostume(); };
  const FILTER_TABS = [
    { key: "all" as SubjectFilter, label: "全部", icon: <Users size={13} /> },
    { key: "character" as SubjectFilter, label: "角色", icon: <Users size={13} /> },
    { key: "scene" as SubjectFilter, label: "场景", icon: <MapPin size={13} /> },
    { key: "prop" as SubjectFilter, label: "道具", icon: <Package size={13} /> },
    { key: "costume" as SubjectFilter, label: "服装", icon: <Shirt size={13} /> },
  ];

  return (
    <div style={{ display: "flex", height: "calc(100vh - 52px)", overflow: "hidden" }}>
      {/* Asset Grid */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {/* Toolbar */}
        <div style={{
          padding: "10px 20px", borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: C.surface, flexShrink: 0,
        }}>
          {/* Filter Tabs */}
          <div style={{ display: "flex", gap: 2, background: "oklch(0.10 0.005 240)", borderRadius: 8, padding: 3 }}>
            {FILTER_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                style={{
                  padding: "4px 14px", borderRadius: 6, cursor: "pointer", border: "none",
                  fontSize: 12, display: "flex", alignItems: "center", gap: 4, transition: "all 0.15s",
                  background: filter === tab.key ? C.green : "transparent",
                  color: filter === tab.key ? "oklch(0.08 0.005 240)" : C.muted,
                }}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <Button
              onClick={() => {
                setDetectingAssets(true);
                fetch("/api/trpc/overseas.autoDetectAssets", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ json: { projectId } }),
                }).then(async (r) => {
                  const text = await r.text();
                  let parsed: any;
                  try {
                    parsed = JSON.parse(text);
                  } catch {
                    throw new Error(text.includes("Rate") || text.includes("rate") ? "AI 服务请求频率超限，请稍后再试" : `服务器返回异常: ${text.slice(0, 100)}`);
                  }
                  if (parsed?.error) {
                    const msg = parsed.error?.message || parsed.error?.json?.message || "识别失败";
                    throw new Error(msg);
                  }
                  return parsed;
                }).then((res: any) => {
                  const data = res?.result?.data?.json;
                  if (data?.addedCount > 0) {
                    toast.success(`AI 识别完成：新增 ${data.addedCount} 个资产（${data.characters} 角色、${data.scenes} 场景、${data.props} 道具、${data.costumes ?? 0} 服装）`);
                    refetchAll();
                  } else {
                    toast.info("未发现新的资产，或所有资产已存在");
                  }
                  setDetectingAssets(false);
                }).catch((e: Error) => { toast.error(e.message ?? "识别失败"); setDetectingAssets(false); });
              }}
              disabled={detectingAssets}
              variant="outline"
              style={{ borderColor: C.greenBorder, color: C.green, fontWeight: 600, fontSize: 12, gap: 5, height: 32 }}
            >
              {detectingAssets ? <><Loader2 size={13} className="animate-spin" /> AI 识别中...</> : <><Sparkles size={13} /> AI 自动识别</>}
            </Button>
            <Button
              onClick={async () => {
                if (generatingPrompts) {
                  // 停止生成
                  stopGeneratingPromptsRef.current = true;
                  return;
                }
                if (allAssets.length === 0) return;
                stopGeneratingPromptsRef.current = false;
                setGeneratingPrompts(true);
                setPromptProgress({ current: 0, total: allAssets.length });
                let generated = 0;
                const errors: string[] = [];
                for (let i = 0; i < allAssets.length; i++) {
                  if (stopGeneratingPromptsRef.current) break;
                  const asset = allAssets[i];
                  setPromptProgress({ current: i + 1, total: allAssets.length });
                  try {
                    const r = await fetch("/api/trpc/overseas.generateSingleAssetPrompt", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      credentials: "include",
                      body: JSON.stringify({ json: { assetId: asset.id, projectId } }),
                    });
                    const text = await r.text();
                    let parsed: any;
                    try { parsed = JSON.parse(text); } catch {
                      throw new Error(text.includes("Rate") ? "AI 服务请求频率超限" : `服务器返回异常`);
                    }
                    if (parsed?.error) throw new Error(parsed.error?.message || parsed.error?.json?.message || "生成失败");
                    generated++;
                    // 每生成5个刷新一次
                    if (generated % 5 === 0) refetchAll();
                  } catch (e: any) {
                    errors.push(`${asset.name}: ${e.message}`);
                  }
                }
                const wasStopped = stopGeneratingPromptsRef.current;
                refetchAll();
                setGeneratingPrompts(false);
                setPromptProgress(null);
                stopGeneratingPromptsRef.current = false;
                if (wasStopped) {
                  toast.info(`已停止，已生成 ${generated} 个提示词`);
                } else if (errors.length > 0) {
                  toast.warning(`生成完成：${generated} 个成功，${errors.length} 个失败`);
                } else {
                  toast.success(`提示词生成完成：${generated} 个资产`);
                }
              }}
              disabled={allAssets.length === 0}
              variant="outline"
              style={{ borderColor: generatingPrompts ? C.red : C.greenBorder, color: generatingPrompts ? C.red : C.green, fontWeight: 600, fontSize: 12, gap: 5, height: 32 }}
            >
              {generatingPrompts
                ? <><X size={13} /> 停止 ({promptProgress?.current ?? 0}/{promptProgress?.total ?? 0})</>
                : <><Wand2 size={13} /> 一键生成提示词</>}
            </Button>
            <Button
              onClick={() => { setAddType("character"); setShowAddDialog(true); }}
              style={{ background: C.green, color: "oklch(0.08 0.005 240)", fontWeight: 700, fontSize: 12, gap: 5, height: 32 }}
            >
              <Plus size={13} /> 新建主体
            </Button>
          </div>
        </div>

        {/* Grid */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", border: `1px dashed ${C.border}`, borderRadius: 12 }}>
              <Users size={40} style={{ color: C.mutedDim, margin: "0 auto 12px" }} />
              <p style={{ color: C.muted, marginBottom: 6 }}>还没有主体资产</p>
              <p style={{ fontSize: 12, color: "oklch(0.35 0.008 240)", marginBottom: 20 }}>
                添加角色、场景、道具，上传 MJ 参考图后可生成一致性主体图
              </p>
              <Button onClick={() => setShowAddDialog(true)} style={{ background: C.green, color: "oklch(0.08 0.005 240)", fontWeight: 700, gap: 6 }}>
                <Plus size={14} /> 新建主体
              </Button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
              {filtered.map(asset => (
                <SubjectCard
                  key={asset.id}
                  asset={asset}
                  selected={selectedAsset?.id === asset.id}
                  onSelect={() => setSelectedAsset(selectedAsset?.id === asset.id ? null : asset)}
                  onRefresh={refetchAll}
                />
              ))}
              {/* Add New Card */}
              <button
                onClick={() => setShowAddDialog(true)}
                style={{
                  border: `2px dashed ${C.border}`, borderRadius: 10, aspectRatio: "9/12",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
                  cursor: "pointer", background: "transparent", color: C.muted, transition: "all 0.2s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.green; (e.currentTarget as HTMLButtonElement).style.color = C.green; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.border; (e.currentTarget as HTMLButtonElement).style.color = C.muted; }}
              >
                <Plus size={20} />
                <span style={{ fontSize: 12 }}>新建主体</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel: New SubjectPanel with style/finalize/multiview */}
      {selectedAsset && (
        <SubjectPanel
          asset={selectedAsset}
          project={project}
          onClose={() => setSelectedAsset(null)}
          onRefresh={refetchAll}
        />
      )}

      <AddSubjectDialog
        open={showAddDialog}
        defaultType={addType}
        onClose={() => setShowAddDialog(false)}
        onCreated={() => { setShowAddDialog(false); refetchAll(); }}
        projectId={projectId}
      />
    </div>
  );
}

function SubjectCard({ asset, selected, onSelect, onRefresh }: {
  asset: OverseasAsset;
  selected: boolean;
  onSelect: () => void;
  onRefresh: () => void;
}) {
  const thumbUrl = asset.mainImageUrl || asset.mjImageUrl;
  const TYPE_LABELS: Record<string, string> = { character: "角色", scene: "场景", prop: "道具", costume: "服装" };
  const TYPE_COLORS: Record<string, string> = { character: C.green, scene: C.blue, prop: C.amber, costume: C.red };

  return (
    <div
      onClick={onSelect}
      style={{
        background: C.card, border: `2px solid ${selected ? C.green : C.border}`,
        borderRadius: 10, overflow: "hidden", cursor: "pointer", transition: "all 0.15s",
        aspectRatio: "9/12", display: "flex", flexDirection: "column",
      }}
    >
      {/* Image */}
      <div style={{ flex: 1, background: "oklch(0.12 0.005 240)", position: "relative", overflow: "hidden" }}>
        {thumbUrl ? (
          <img src={thumbUrl} alt={asset.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Users size={28} style={{ color: C.mutedDim }} />
          </div>
        )}
        {/* Type Badge */}
        <div style={{
          position: "absolute", top: 6, left: 6,
          fontSize: 9, padding: "2px 6px", borderRadius: 4,
          background: `${TYPE_COLORS[asset.type]}20`,
          color: TYPE_COLORS[asset.type],
          border: `1px solid ${TYPE_COLORS[asset.type]}50`,
        }}>
          {TYPE_LABELS[asset.type]}
        </div>
        {/* Elements Badge */}
        {asset.isGlobalRef && (
          <div style={{
            position: "absolute", top: 6, right: 6,
            fontSize: 9, padding: "2px 6px", borderRadius: 4,
            background: "oklch(0.75 0.17 65 / 0.2)", color: C.amber,
            border: `1px solid oklch(0.75 0.17 65 / 0.5)`,
          }}>
            ⚡ Elements
          </div>
        )}
        {/* Select Overlay */}
        {selected && (
          <div style={{
            position: "absolute", inset: 0, background: `${C.green}20`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: C.green, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Check size={16} style={{ color: "oklch(0.08 0.005 240)" }} />
            </div>
          </div>
        )}
      </div>
      {/* Name */}
      <div style={{ padding: "8px 10px", borderTop: `1px solid ${C.border}` }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{asset.name}</p>
        <p style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
          {thumbUrl ? "已上传参考图" : "点击选择 → 生成主体图"}
        </p>
      </div>
    </div>
  );
}
function AddSubjectDialog({ open, defaultType, onClose, onCreated, projectId }: {
  open: boolean;
  defaultType: "character" | "scene" | "prop" | "costume";
  onClose: () => void;
  onCreated: () => void;
  projectId: number;
}) {
  const [form, setForm] = useState({ name: "", type: defaultType, description: "" });
  const createAsset = trpc.overseas.createAsset.useMutation({
    onSuccess: () => { toast.success("主体已创建"); onCreated(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent style={{ background: C.surface, border: `1px solid ${C.border}`, maxWidth: 420 }}>
        <DialogHeader>
          <DialogTitle style={{ color: C.text }}>新建主体</DialogTitle>
        </DialogHeader>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "8px 0" }}>
          <div>
            <label style={{ fontSize: 12, color: C.muted, marginBottom: 6, display: "block" }}>主体类型</label>
            <div style={{ display: "flex", gap: 6 }}>
              {[
                { key: "character", label: "角色", icon: <Users size={13} /> },
                { key: "scene", label: "场景", icon: <MapPin size={13} /> },
                { key: "prop", label: "道具", icon: <Package size={13} /> },
                { key: "costume", label: "服装", icon: <Shirt size={13} /> },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setForm(f => ({ ...f, type: t.key as "character" | "scene" | "prop" | "costume" }))}
                  style={{
                    flex: 1, padding: "8px 0", borderRadius: 8, cursor: "pointer",
                    border: `2px solid ${form.type === t.key ? C.green : C.border}`,
                    background: form.type === t.key ? C.greenDim : "transparent",
                    color: form.type === t.key ? C.green : C.muted,
                    fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                  }}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, color: C.muted, marginBottom: 6, display: "block" }}>名称</label>
            <Input
              placeholder={form.type === "character" ? "例：LUCAS" : form.type === "scene" ? "例：废弃营地_中心" : "例：战术匕首"}
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              style={{ background: "oklch(0.18 0.006 240)", border: `1px solid ${C.border}`, color: C.text }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: C.muted, marginBottom: 6, display: "block" }}>描述（可选）</label>
            <Textarea
              placeholder="简要描述外观特征..."
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
              style={{ background: "oklch(0.18 0.006 240)", border: `1px solid ${C.border}`, color: C.text, resize: "none" }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} style={{ borderColor: C.border, color: C.muted }}>取消</Button>
          <Button
            onClick={() => createAsset.mutate({ projectId, type: form.type, name: form.name, description: form.description || undefined })}
            disabled={!form.name.trim() || createAsset.isPending}
            style={{ background: C.green, color: "oklch(0.08 0.005 240)", fontWeight: 700 }}
          >
            {createAsset.isPending ? <Loader2 className="animate-spin w-4 h-4" /> : "创建"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── 故事版 Tab ───────────────────────────────────────────────────────────────
function StoryboardTab({ projectId, project, activeEpisode, onEpisodeChange }: {
  projectId: number;
  project: OverseasProject;
  activeEpisode: number;
  onEpisodeChange: (ep: number) => void;
}) {
  const [activeShotId, setActiveShotId] = useState<number | null>(null);
  const [activePanel, setActivePanel] = useState<StoryboardPanel>("image");
  const [showBatchRun, setShowBatchRun] = useState(false);

  const { data: shotsData, refetch } = trpc.overseas.listShots.useQuery({ projectId, episodeNumber: activeEpisode });
  const shots = (shotsData ?? []) as ScriptShot[];

  const autoGenMutation = trpc.overseas.autoGeneratePrompts.useMutation({
    onSuccess: (data) => {
      toast.success(`提示词生成完成：${data.imagePrompts} 个生图、${data.videoPrompts} 个视频`);
      refetch();
    },
    onError: (e) => toast.error(e.message ?? "生成失败"),
  });

  const activeShot = shots.find(s => s.id === activeShotId) ?? shots[0] ?? null;

  // Auto-select first shot when episode changes
  const prevEpisode = useRef(activeEpisode);
  if (prevEpisode.current !== activeEpisode) {
    prevEpisode.current = activeEpisode;
    setActiveShotId(null);
  }

  const displayShot = activeShotId ? shots.find(s => s.id === activeShotId) ?? null : shots[0] ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 52px)", overflow: "hidden" }}>
      {/* Top Bar */}
      <div style={{
        padding: "8px 16px", borderBottom: `1px solid ${C.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: C.surface, flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, color: C.muted }}>第</span>
          <Select value={String(activeEpisode)} onValueChange={v => onEpisodeChange(Number(v))}>
            <SelectTrigger style={{ background: "oklch(0.18 0.006 240)", border: `1px solid ${C.border}`, color: C.text, width: 80, height: 30, fontSize: 13 }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              {Array.from({ length: project.totalEpisodes ?? 20 }, (_, i) => i + 1).map(ep => (
                <SelectItem key={ep} value={String(ep)} style={{ color: C.text }}>第 {ep} 集</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span style={{ fontSize: 13, color: C.muted }}>共 {shots.length} 个镜头</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Button
            onClick={() => {
              if (shots.length === 0) { toast.error("没有分镜，请先导入剧本"); return; }
              if (autoGenMutation.isPending) return;
              toast.info("正在批量生成提示词，请稍候...");
              autoGenMutation.mutate({ projectId, episodeNumber: activeEpisode });
            }}
            disabled={autoGenMutation.isPending}
            variant="outline"
            style={{ borderColor: C.greenBorder, color: C.green, fontWeight: 600, fontSize: 12, gap: 5, height: 30 }}
          >
            <Wand2 size={12} /> 自动生成提示词
          </Button>
          <button style={{ display: "flex", alignItems: "center", gap: 4, color: C.green, cursor: "pointer", background: C.greenDim, border: `1px solid ${C.greenBorder}`, borderRadius: 6, fontSize: 12, padding: "4px 10px", fontWeight: 600 }}
            onClick={() => setShowBatchRun(true)}
          >
            <Zap size={12} /> 一键跑量
          </button>
          <button
            style={{ display: "flex", alignItems: "center", gap: 4, color: C.muted, cursor: "pointer", background: "none", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, padding: "4px 10px" }}
            onClick={() => {
              const videoShots = shots.filter(s => s.videoUrl);
              if (videoShots.length === 0) { toast.error("本集没有已生成的视频"); return; }
              // Export as text list with URLs
              const lines = videoShots.map(s => `第${s.episodeNumber}集 镜头${s.shotNumber}\t${s.videoUrl}`);
              const content = lines.join("\n");
              const blob = new Blob([content], { type: "text/plain" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `ep${activeEpisode}-videos.txt`;
              a.click();
              URL.revokeObjectURL(url);
              toast.success(`已导出 ${videoShots.length} 个视频链接`);
            }}
            title="导出本集所有视频链接"
          >
            <FileDown size={12} /> 导出视频列表
          </button>
        </div>
      </div>

      {/* Main Area */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Center: Large Preview */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: C.bg, position: "relative" }}>
          {shots.length === 0 ? (
            <div style={{ textAlign: "center" }}>
              <Film size={48} style={{ color: C.mutedDim, marginBottom: 12 }} />
              <p style={{ color: C.muted, marginBottom: 6 }}>第 {activeEpisode} 集还没有分镜</p>
              <p style={{ fontSize: 12, color: "oklch(0.35 0.008 240)" }}>请先在「剧本」Tab 导入并拆解剧本</p>
            </div>
          ) : displayShot ? (
            <ShotPreview shot={displayShot} project={project} onRefresh={refetch} />
          ) : null}
        </div>

        {/* Right Panel */}
        {displayShot && (
          <StoryboardRightPanel
            shot={displayShot}
            project={project}
            activePanel={activePanel}
            onPanelChange={setActivePanel}
            projectId={projectId}
            onRefresh={refetch}
          />
        )}
      </div>

      {/* Bottom: Shot Strip */}
      {shots.length > 0 && (
        <ShotStrip
          shots={shots}
          activeShotId={displayShot?.id ?? null}
          onSelect={(id) => setActiveShotId(id)}
          project={project}
        />
      )}

      {/* Batch Run Dialog */}
      <BatchRunDialog
        open={showBatchRun}
        onClose={() => setShowBatchRun(false)}
        projectId={projectId}
        project={project}
        activeEpisode={activeEpisode}
        onComplete={() => { setShowBatchRun(false); refetch(); }}
      />
    </div>
  );
}

function ShotPreview({ shot, project, onRefresh }: { shot: ScriptShot; project: OverseasProject; onRefresh: () => void }) {
  const isPortrait = project.aspectRatio === "portrait";
  const hasVideo = !!shot.videoUrl;
  const hasImage = !!shot.firstFrameUrl;
  const [isFullscreen, setIsFullscreen] = useState(false);

  const downloadFile = (url: string, filename: string) => {
    const a = document.createElement("a");
    a.href = `/api/download-proxy?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
    a.download = filename;
    a.click();
  };

  const videoRef = useRef<HTMLVideoElement>(null);

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, maxHeight: "100%" }}>
        {/* Image/Video Preview */}
        <div style={{
          borderRadius: 10, overflow: "hidden", background: "oklch(0.12 0.005 240)",
          border: `1px solid ${C.border}`,
          ...(isPortrait
            ? { height: "min(480px, calc(100vh - 280px))", aspectRatio: "9/16" }
            : { width: "min(720px, calc(100vw - 400px))", aspectRatio: "16/9" }
          ),
          position: "relative",
        }}>
          {hasVideo ? (
            <video
              ref={videoRef}
              src={shot.videoUrl!}
              controls
              autoPlay={false}
              loop
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : hasImage ? (
            <img src={shot.firstFrameUrl!} alt={`镜头 ${shot.shotNumber}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8 }}>
              <ImageIcon size={36} style={{ color: C.mutedDim }} />
              <span style={{ fontSize: 12, color: C.muted }}>暂无首帧图片</span>
            </div>
          )}
          {/* Shot Number Badge */}
          <div style={{
            position: "absolute", top: 10, left: 10,
            background: "oklch(0.08 0.005 240 / 0.85)", borderRadius: 6,
            padding: "3px 8px", fontSize: 11, color: C.green,
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            镜头 {shot.episodeNumber}.{shot.shotNumber}
          </div>
          {/* Video badge */}
          {hasVideo && (
            <div style={{
              position: "absolute", top: 10, right: 10,
              background: "oklch(0.08 0.005 240 / 0.85)", borderRadius: 6,
              padding: "3px 8px", fontSize: 10, color: C.amber,
              display: "flex", alignItems: "center", gap: 4,
            }}>
              <Play size={9} fill={C.amber} /> 视频已生成
            </div>
          )}
          {/* Fullscreen button */}
          {(hasVideo || hasImage) && (
            <button
              onClick={() => setIsFullscreen(true)}
              style={{
                position: "absolute", bottom: 10, right: 10,
                width: 28, height: 28, borderRadius: 6,
                background: "oklch(0.08 0.005 240 / 0.85)", border: `1px solid ${C.border}`,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: C.muted,
              }}
              title="全屏预览"
            >
              <Maximize2 size={12} />
            </button>
          )}
        </div>

        {/* Action Bar */}
        <div style={{ display: "flex", gap: 12, fontSize: 12, color: C.muted, alignItems: "center" }}>
          {hasImage && (
            <button
              onClick={() => downloadFile(shot.firstFrameUrl!, `shot-${shot.episodeNumber}-${shot.shotNumber}-frame.jpg`)}
              style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", background: "none", border: "none", color: C.muted }}
            >
              <Download size={12} /> 下载首帧
            </button>
          )}
          {hasVideo && (
            <button
              onClick={() => downloadFile(shot.videoUrl!, `shot-${shot.episodeNumber}-${shot.shotNumber}-video.mp4`)}
              style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", background: "none", border: "none", color: C.amber }}
            >
              <Download size={12} /> 下载视频
            </button>
          )}
          {hasImage && (
            <button style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", background: "none", border: "none", color: C.muted }}>
              <RefreshCw size={12} /> 重绘
            </button>
          )}
        </div>
      </div>

      {/* Fullscreen Modal */}
      {isFullscreen && (
        <div
          onClick={() => setIsFullscreen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "oklch(0.05 0.005 240 / 0.95)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <button
            onClick={() => setIsFullscreen(false)}
            style={{
              position: "absolute", top: 20, right: 20,
              width: 36, height: 36, borderRadius: "50%",
              background: "oklch(0.2 0.006 240)", border: `1px solid ${C.border}`,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: C.text,
            }}
          >
            <X size={16} />
          </button>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              ...(isPortrait
                ? { height: "90vh", aspectRatio: "9/16" }
                : { width: "90vw", aspectRatio: "16/9" }
              ),
              borderRadius: 12, overflow: "hidden",
            }}
          >
            {hasVideo ? (
              <video src={shot.videoUrl!} controls autoPlay loop style={{ width: "100%", height: "100%", objectFit: "contain", background: "#000" }} />
            ) : (
              <img src={shot.firstFrameUrl!} alt="fullscreen" style={{ width: "100%", height: "100%", objectFit: "contain", background: "#000" }} />
            )}
          </div>
        </div>
      )}
    </>
  );
}


// ─── 故事板右侧面板（图片 + 视频生成） ─────────────────────────────────────────
function StoryboardRightPanel({ shot, project, activePanel, onPanelChange, projectId, onRefresh }: {
  shot: ScriptShot;
  project: OverseasProject;
  activePanel: StoryboardPanel;
  onPanelChange: (p: StoryboardPanel) => void;
  projectId: number;
  onRefresh: () => void;
}) {
  const [imagePrompt, setImagePrompt] = useState(shot.firstFramePrompt ?? "");
  const [videoPrompt, setVideoPrompt] = useState(shot.videoPrompt ?? "");
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [selectedImageEngine, setSelectedImageEngine] = useState(shot.imageEngine || project.imageEngine || "doubao-seedream-4-5-251128");
  const [selectedVideoEngine, setSelectedVideoEngine] = useState(shot.videoEngine || project.videoEngine || "seedance_1_5");
  const [lastFrameUrl, setLastFrameUrl] = useState<string | null>(shot.lastFrameUrl);
  const [subjectRefUrls, setSubjectRefUrls] = useState<string[]>(() => {
    try { return shot.subjectRefUrls ? JSON.parse(shot.subjectRefUrls) : []; } catch { return []; }
  });
  const [videoDuration, setVideoDuration] = useState(shot.videoDuration || 5);
  const [videoResolution, setVideoResolution] = useState<"480p" | "720p" | "1080p">("1080p");
  const [videoAspectRatio, setVideoAspectRatio] = useState(project.aspectRatio === "portrait" ? "9:16" : "16:9");
  const [smartDuration, setSmartDuration] = useState(false);

  // Fetch available subjects for reference
  const { data: allAssets } = trpc.overseas.listAssets.useQuery({ projectId });
  const availableSubjects = (allAssets ?? []).filter((a: any) => a.mainImageUrl || a.mjImageUrl).map((a: any) => ({
    id: a.id, name: a.name, type: a.type, imageUrl: a.mainImageUrl || a.mjImageUrl,
  }));

  const generateFrame = trpc.overseas.generateFrame.useMutation();
  const generateVideo = trpc.overseas.generateVideo.useMutation();
  const updateShot = trpc.overseas.updateShot.useMutation();

  // Sync prompts when shot changes
  const prevShotId = useRef(shot.id);
  if (prevShotId.current !== shot.id) {
    prevShotId.current = shot.id;
    setImagePrompt(shot.firstFramePrompt ?? "");
    setVideoPrompt(shot.videoPrompt ?? "");
    setSelectedImageEngine(shot.imageEngine || project.imageEngine || "doubao-seedream-4-5-251128");
    setSelectedVideoEngine(shot.videoEngine || project.videoEngine || "seedance_1_5");
    setLastFrameUrl(shot.lastFrameUrl);
    try { setSubjectRefUrls(shot.subjectRefUrls ? JSON.parse(shot.subjectRefUrls) : []); } catch { setSubjectRefUrls([]); }
    setVideoDuration(shot.videoDuration || 5);
    setVideoAspectRatio(project.aspectRatio === "portrait" ? "9:16" : "16:9");
    setVideoResolution("1080p");
    setSmartDuration(false);
  }

  async function handleGenerateImage() {
    if (!imagePrompt.trim()) { toast.error("请输入首帧提示词"); return; }
    setGeneratingImage(true);
    try {
      await generateFrame.mutateAsync({
        shotId: shot.id,
        frameType: "first",
        imageEngine: selectedImageEngine,
        subjectRefUrls: subjectRefUrls.length > 0 ? subjectRefUrls : undefined,
      });
      toast.success("首帧生成完成");
      onRefresh();
    } catch (e: any) {
      toast.error(e.message ?? "生成失败");
    } finally {
      setGeneratingImage(false);
    }
  }

  async function handleGenerateLastFrame() {
    if (!imagePrompt.trim()) { toast.error("请输入尾帧提示词"); return; }
    setGeneratingImage(true);
    try {
      await generateFrame.mutateAsync({
        shotId: shot.id,
        frameType: "last",
        imageEngine: selectedImageEngine,
      });
      toast.success("尾帧生成完成");
      onRefresh();
    } catch (e: any) {
      toast.error(e.message ?? "生成失败");
    } finally {
      setGeneratingImage(false);
    }
  }

  async function handleGenerateVideo() {
    if (!shot.firstFrameUrl) { toast.error("请先生成首帧图片"); return; }
    setGeneratingVideo(true);
    try {
      await generateVideo.mutateAsync({
        shotId: shot.id,
        engine: selectedVideoEngine as any,
        duration: videoDuration,
        aspectRatio: videoAspectRatio,
        resolution: videoResolution,
        smartDuration,
        generateAudio: true,
        useLastFrame: !!lastFrameUrl,
        referenceImageUrls: subjectRefUrls.length > 0 ? subjectRefUrls : undefined,
        subjectRefUrls: subjectRefUrls.length > 0 ? subjectRefUrls : undefined,
      });
      toast.success("视频生成完成");
      onRefresh();
    } catch (e: any) {
      toast.error(e.message ?? "视频生成失败");
    } finally {
      setGeneratingVideo(false);
    }
  }

  async function handleUploadFile(file: File): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload-asset-s3", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "上传失败");
    return data.url;
  }

  async function handleLastFrameUpload(url: string) {
    setLastFrameUrl(url);
    await updateShot.mutateAsync({ id: shot.id, lastFrameUrl: url });
  }

  async function handleSubjectRefAdd(url: string) {
    const updated = [...subjectRefUrls, url];
    setSubjectRefUrls(updated);
    await updateShot.mutateAsync({ id: shot.id, subjectRefUrls: JSON.stringify(updated) });
  }

  async function handleSubjectRefRemove(index: number) {
    const updated = subjectRefUrls.filter((_, i) => i !== index);
    setSubjectRefUrls(updated);
    await updateShot.mutateAsync({ id: shot.id, subjectRefUrls: JSON.stringify(updated) });
  }

  const panelW = 340;
  return (
    <div style={{ width: panelW, minWidth: panelW, borderLeft: `1px solid ${C.border}`, background: C.surface, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Panel Tabs */}
      <div style={{ display: "flex", borderBottom: `1px solid ${C.border}` }}>
        {(["image", "video"] as const).map(p => (
          <button
            key={p}
            onClick={() => onPanelChange(p)}
            style={{
              flex: 1, padding: "10px 0", cursor: "pointer",
              background: activePanel === p ? C.greenDim : "transparent",
              color: activePanel === p ? C.green : C.muted,
              border: "none", borderBottom: activePanel === p ? `2px solid ${C.green}` : "2px solid transparent",
              fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
            }}
          >
            {p === "image" ? <><ImageIcon size={13} /> 首帧生图</> : <><Video size={13} /> 视频生成</>}
          </button>
        ))}
      </div>

      {/* Panel Content */}
      <div style={{ flex: 1, overflow: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        {activePanel === "image" ? (
          <>
            {/* Image Engine Selector */}
            <div>
              <label style={{ fontSize: 11, color: C.muted, marginBottom: 4, display: "block" }}>图片模型</label>
              <Select value={selectedImageEngine} onValueChange={setSelectedImageEngine}>
                <SelectTrigger style={{ background: C.bg, borderColor: C.border, color: C.text, height: 32, fontSize: 12 }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMAGE_MODELS.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Image Prompt */}
            <div>
              <label style={{ fontSize: 11, color: C.muted, marginBottom: 4, display: "block" }}>首帧提示词</label>
              <Textarea
                value={imagePrompt}
                onChange={e => setImagePrompt(e.target.value)}
                rows={5}
                style={{ background: C.bg, borderColor: C.border, color: C.text, fontSize: 12, resize: "vertical" }}
                placeholder="描述画面内容..."
              />
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <Button
                  onClick={() => {
                    updateShot.mutateAsync({ id: shot.id, firstFramePrompt: imagePrompt }).then(() => toast.success("提示词已保存"));
                  }}
                  variant="outline" size="sm"
                  style={{ fontSize: 11, borderColor: C.border, color: C.muted }}
                >
                  <Check size={11} /> 保存
                </Button>
              </div>
            </div>

            {/* Subject References */}
            {subjectRefUrls.length > 0 && (
              <div>
                <label style={{ fontSize: 11, color: C.muted, marginBottom: 4, display: "block" }}>主体参考图</label>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {subjectRefUrls.map((url, i) => (
                    <div key={i} style={{ position: "relative", width: 48, height: 48, borderRadius: 6, overflow: "hidden", border: `1px solid ${C.border}` }}>
                      <img src={url} alt="ref" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      <button
                        onClick={() => handleSubjectRefRemove(i)}
                        style={{ position: "absolute", top: 1, right: 1, width: 16, height: 16, borderRadius: "50%", background: "oklch(0.3 0.05 25)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        <X size={10} style={{ color: "white" }} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Generate Buttons */}
            <div style={{ display: "flex", gap: 6 }}>
              <Button
                onClick={handleGenerateImage}
                disabled={generatingImage || !imagePrompt.trim()}
                style={{ flex: 1, background: C.green, color: "oklch(0.13 0.005 240)", fontWeight: 700, fontSize: 12, height: 36 }}
              >
                {generatingImage ? <><Loader2 size={13} className="animate-spin" /> 生成中...</> : <><Wand2 size={13} /> 生成首帧</>}
              </Button>
              <Button
                onClick={handleGenerateLastFrame}
                disabled={generatingImage}
                variant="outline"
                style={{ borderColor: C.border, color: C.muted, fontSize: 12, height: 36 }}
              >
                尾帧
              </Button>
            </div>

            {/* Quick Subject Ref Add */}
            {availableSubjects.length > 0 && (
              <div>
                <label style={{ fontSize: 11, color: C.muted, marginBottom: 4, display: "block" }}>快速添加主体参考</label>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {availableSubjects.slice(0, 8).map(s => (
                    <button
                      key={s.id}
                      onClick={() => s.imageUrl && handleSubjectRefAdd(s.imageUrl)}
                      style={{
                        width: 40, height: 40, borderRadius: 6, overflow: "hidden",
                        border: `1px solid ${C.border}`, cursor: "pointer", padding: 0,
                        opacity: subjectRefUrls.includes(s.imageUrl || "") ? 0.4 : 1,
                      }}
                      title={s.name}
                    >
                      {s.imageUrl ? (
                        <img src={s.imageUrl} alt={s.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, fontSize: 10, color: C.muted }}>
                          {s.name[0]}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          /* ─── Video Panel ─── */
          <>
            {/* Video Model Selector with dynamic UI */}
            <VideoModelSelector
              selectedEngine={selectedVideoEngine}
              onEngineChange={setSelectedVideoEngine}
              firstFrameUrl={shot.firstFrameUrl}
              lastFrameUrl={lastFrameUrl}
              subjectRefUrls={subjectRefUrls}
              onFirstFrameUpload={async (url) => {
                await updateShot.mutateAsync({ id: shot.id, firstFrameUrl: url });
                onRefresh();
              }}
              onLastFrameUpload={handleLastFrameUpload}
              onSubjectRefAdd={handleSubjectRefAdd}
              onSubjectRefRemove={handleSubjectRefRemove}
              availableSubjects={availableSubjects}
            />

            {/* Video Prompt */}
            <div>
              <label style={{ fontSize: 11, color: C.muted, marginBottom: 4, display: "block" }}>视频提示词</label>
              <Textarea
                value={videoPrompt}
                onChange={e => setVideoPrompt(e.target.value)}
                rows={4}
                style={{ background: C.bg, borderColor: C.border, color: C.text, fontSize: 12, resize: "vertical" }}
                placeholder="描述视频动作和运镜..."
              />
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <Button
                  onClick={() => {
                    updateShot.mutateAsync({ id: shot.id, videoPrompt }).then(() => toast.success("视频提示词已保存"));
                  }}
                  variant="outline" size="sm"
                  style={{ fontSize: 11, borderColor: C.border, color: C.muted }}
                >
                  <Check size={11} /> 保存
                </Button>
              </div>
            </div>

            {/* Seedance 1.5 Pro: Aspect Ratio + Resolution + Duration */}
            {selectedVideoEngine === "seedance_1_5" ? (
              <>
                {/* Aspect Ratio */}
                <div>
                  <label style={{ fontSize: 11, color: C.muted, marginBottom: 4, display: "block" }}>视频比例</label>
                  <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                    {(["21:9", "16:9", "4:3", "1:1", "3:4", "9:16", "auto"] as const).map(r => (
                      <button
                        key={r}
                        onClick={() => setVideoAspectRatio(r)}
                        style={{
                          padding: "4px 8px", borderRadius: 5, cursor: "pointer",
                          border: `1px solid ${videoAspectRatio === r ? C.green : C.border}`,
                          background: videoAspectRatio === r ? C.greenDim : "transparent",
                          color: videoAspectRatio === r ? C.green : C.muted,
                          fontSize: 11, fontWeight: 600,
                        }}
                      >
                        {r === "auto" ? "智能" : r}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Resolution */}
                <div>
                  <label style={{ fontSize: 11, color: C.muted, marginBottom: 4, display: "block" }}>分辨率</label>
                  <div style={{ display: "flex", gap: 4 }}>
                    {(["480p", "720p", "1080p"] as const).map(r => (
                      <button
                        key={r}
                        onClick={() => setVideoResolution(r)}
                        style={{
                          flex: 1, padding: "6px 0", borderRadius: 6, cursor: "pointer",
                          border: `1px solid ${videoResolution === r ? C.green : C.border}`,
                          background: videoResolution === r ? C.greenDim : "transparent",
                          color: videoResolution === r ? C.green : C.muted,
                          fontSize: 12, fontWeight: 600,
                        }}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Duration */}
                <div>
                  <label style={{ fontSize: 11, color: C.muted, marginBottom: 4, display: "block" }}>视频时长</label>
                  <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                    <button
                      onClick={() => setSmartDuration(false)}
                      style={{
                        flex: 1, padding: "6px 0", borderRadius: 6, cursor: "pointer",
                        border: `1px solid ${!smartDuration ? C.green : C.border}`,
                        background: !smartDuration ? C.greenDim : "transparent",
                        color: !smartDuration ? C.green : C.muted,
                        fontSize: 12, fontWeight: 600,
                      }}
                    >
                      按秒数
                    </button>
                    <button
                      onClick={() => setSmartDuration(true)}
                      style={{
                        flex: 1, padding: "6px 0", borderRadius: 6, cursor: "pointer",
                        border: `1px solid ${smartDuration ? C.green : C.border}`,
                        background: smartDuration ? C.greenDim : "transparent",
                        color: smartDuration ? C.green : C.muted,
                        fontSize: 12, fontWeight: 600,
                      }}
                    >
                      智能时长
                    </button>
                  </div>
                  {!smartDuration && (
                    <div style={{ display: "flex", gap: 4 }}>
                      {[4, 5, 6, 8, 10, 12].map(d => (
                        <button
                          key={d}
                          onClick={() => setVideoDuration(d)}
                          style={{
                            flex: 1, padding: "5px 0", borderRadius: 6, cursor: "pointer",
                            border: `1px solid ${videoDuration === d ? C.green : C.border}`,
                            background: videoDuration === d ? C.greenDim : "transparent",
                            color: videoDuration === d ? C.green : C.muted,
                            fontSize: 11, fontWeight: 600,
                          }}
                        >
                          {d}s
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Other engines: simple duration selector */
              <div>
                <label style={{ fontSize: 11, color: C.muted, marginBottom: 4, display: "block" }}>时长（秒）</label>
                <div style={{ display: "flex", gap: 4 }}>
                  {[3, 5, 8, 10, 15].map(d => (
                    <button
                      key={d}
                      onClick={() => setVideoDuration(d)}
                      style={{
                        flex: 1, padding: "6px 0", borderRadius: 6, cursor: "pointer",
                        border: `1px solid ${videoDuration === d ? C.green : C.border}`,
                        background: videoDuration === d ? C.greenDim : "transparent",
                        color: videoDuration === d ? C.green : C.muted,
                        fontSize: 12, fontWeight: 600,
                      }}
                    >
                      {d}s
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Generate Video Button */}
            <Button
              onClick={handleGenerateVideo}
              disabled={generatingVideo || !shot.firstFrameUrl}
              style={{ width: "100%", background: C.green, color: "oklch(0.13 0.005 240)", fontWeight: 700, fontSize: 13, height: 40 }}
            >
              {generatingVideo ? (
                <><Loader2 size={14} className="animate-spin" /> 视频生成中...</>
              ) : (
                <><Play size={14} /> 生成视频 ({getVideoModelName(selectedVideoEngine)})</>
              )}
            </Button>

            {!shot.firstFrameUrl && (
              <p style={{ fontSize: 11, color: C.amber, textAlign: "center" }}>
                <AlertCircle size={11} style={{ display: "inline", marginRight: 4 }} />
                请先在「首帧生图」面板生成首帧图片
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── 底部镜头条 ───────────────────────────────────────────────────────────────
function ShotStrip({ shots, activeShotId, onSelect, project }: {
  shots: ScriptShot[];
  activeShotId: number | null;
  onSelect: (id: number) => void;
  project: OverseasProject;
}) {
  const isPortrait = project.aspectRatio === "portrait";
  const stripRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    if (!stripRef.current) return;
    stripRef.current.scrollBy({ left: dir === "left" ? -300 : 300, behavior: "smooth" });
  };

  return (
    <div style={{
      height: 120, background: C.surface, borderTop: `1px solid ${C.border}`,
      display: "flex", alignItems: "center", flexShrink: 0, position: "relative",
    }}>
      {/* Scroll Left */}
      <button
        onClick={() => scroll("left")}
        style={{ position: "absolute", left: 6, zIndex: 2, width: 28, height: 28, borderRadius: "50%", background: "oklch(0.20 0.006 240)", border: `1px solid ${C.border}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: C.muted }}
      >
        <ChevronLeft size={14} />
      </button>

      {/* Strip */}
      <div
        ref={stripRef}
        style={{
          display: "flex", gap: 8, overflowX: "auto", padding: "8px 40px",
          scrollbarWidth: "none", flex: 1,
        }}
      >
        {shots.map((shot, idx) => {
          const isActive = shot.id === activeShotId || (!activeShotId && idx === 0);
          const thumb = shot.firstFrameUrl;
          const hasVideo = !!shot.videoUrl;

          return (
            <div
              key={shot.id}
              onClick={() => onSelect(shot.id)}
              style={{
                flexShrink: 0, width: isPortrait ? 56 : 96, height: 96,
                borderRadius: 8, overflow: "hidden", cursor: "pointer",
                border: `2px solid ${isActive ? C.green : C.border}`,
                background: "oklch(0.12 0.005 240)", position: "relative",
                transition: "border-color 0.15s",
              }}
            >
              {thumb ? (
                <img src={thumb} alt={`镜头 ${shot.shotNumber}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ImageIcon size={16} style={{ color: C.mutedDim }} />
                </div>
              )}
              {/* Shot Number */}
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                background: "oklch(0.08 0.005 240 / 0.85)", padding: "2px 4px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <span style={{ fontSize: 9, color: isActive ? C.green : C.muted, fontFamily: "'JetBrains Mono', monospace" }}>
                  {shot.episodeNumber}.{shot.shotNumber}
                </span>
                {hasVideo && <Play size={8} style={{ color: C.green }} />}
              </div>
              {/* Status dot */}
              {shot.status === "generating_frame" || shot.status === "generating_video" ? (
                <div style={{ position: "absolute", top: 4, right: 4, width: 6, height: 6, borderRadius: "50%", background: C.amber }} />
              ) : shot.status === "done" ? (
                <div style={{ position: "absolute", top: 4, right: 4, width: 6, height: 6, borderRadius: "50%", background: C.green }} />
              ) : null}
            </div>
          );
        })}

        {/* Add Shot */}
        <div
          style={{
            flexShrink: 0, width: isPortrait ? 56 : 96, height: 96,
            borderRadius: 8, border: `2px dashed ${C.border}`, cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
            color: C.muted, background: "transparent", transition: "all 0.15s",
          }}
          onClick={() => toast.info("功能开发中：手动添加镜头")}
        >
          <Plus size={16} />
          <span style={{ fontSize: 9 }}>添加</span>
        </div>
      </div>

      {/* Scroll Right */}
      <button
        onClick={() => scroll("right")}
        style={{ position: "absolute", right: 6, zIndex: 2, width: 28, height: 28, borderRadius: "50%", background: "oklch(0.20 0.006 240)", border: `1px solid ${C.border}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: C.muted }}
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

// ─── 一键跑量对话框 ───────────────────────────────────────────────────────────
function BatchRunDialog({ open, onClose, projectId, project, activeEpisode, onComplete }: {
  open: boolean;
  onClose: () => void;
  projectId: number;
  project: OverseasProject;
  activeEpisode: number;
  onComplete: () => void;
}) {
  const [mode, setMode] = useState<"image" | "video" | "both">("both");
  const [skipExisting, setSkipExisting] = useState(true);
  const [selectedEpisodes, setSelectedEpisodes] = useState<number[]>([activeEpisode]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; current: string } | null>(null);
  const [batchVideoEngine, setBatchVideoEngine] = useState(project.videoEngine || "seedance_1_5");
  const [batchDuration, setBatchDuration] = useState(5);
  const [batchResolution, setBatchResolution] = useState<"480p" | "720p" | "1080p">("1080p");

  const batchRun = trpc.overseas.batchRun.useMutation();

  const toggleEpisode = (ep: number) => {
    setSelectedEpisodes(prev =>
      prev.includes(ep) ? prev.filter(e => e !== ep) : [...prev, ep]
    );
  };

  async function handleRun() {
    if (selectedEpisodes.length === 0) { toast.error("请选择至少一集"); return; }
    setRunning(true);
    setProgress({ done: 0, total: selectedEpisodes.length, current: "准备中..." });
    try {
      const result = await batchRun.mutateAsync({
        projectId,
        episodeNumbers: selectedEpisodes.sort((a, b) => a - b),
        engine: batchVideoEngine as any,
        aspectRatio: project.aspectRatio === "portrait" ? "9:16" : "16:9",
        resolution: batchResolution,
        smartDuration: false,
        duration: batchDuration,
        generateAudio: true,
        skipExisting,
        mode,
      });
      toast.success(`跑量完成！处理 ${result.processed} 个，失败 ${result.failed} 个`);
      onComplete();
    } catch (e: any) {
      toast.error(e.message ?? "跑量失败");
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }

  const totalEpisodes = project.totalEpisodes ?? 20;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent style={{ background: C.surface, border: `1px solid ${C.border}`, maxWidth: 480 }}>
        <DialogHeader>
          <DialogTitle style={{ color: C.text, display: "flex", alignItems: "center", gap: 8 }}>
            <Zap size={18} style={{ color: C.green }} /> 一键跑量
          </DialogTitle>
        </DialogHeader>

        {running ? (
          <div style={{ padding: "24px 0", textAlign: "center" }}>
            <Loader2 size={32} className="animate-spin" style={{ color: C.green, margin: "0 auto 12px" }} />
            <p style={{ color: C.text, fontSize: 14, fontWeight: 600 }}>正在批量生成中...</p>
            {progress && (
              <p style={{ color: C.muted, fontSize: 12, marginTop: 6 }}>{progress.current}</p>
            )}
            <p style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>
              此过程可能需要数分钟，请勿关闭页面
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "8px 0" }}>
            {/* Mode */}
            <div>
              <label style={{ fontSize: 12, color: C.muted, marginBottom: 6, display: "block" }}>生成内容</label>
              <div style={{ display: "flex", gap: 6 }}>
                {[
                  { key: "both", label: "首帧 + 视频" },
                  { key: "image", label: "仅首帧图" },
                  { key: "video", label: "仅视频" },
                ].map(m => (
                  <button
                    key={m.key}
                    onClick={() => setMode(m.key as "image" | "video" | "both")}
                    style={{
                      flex: 1, padding: "8px 0", borderRadius: 8, cursor: "pointer",
                      border: `2px solid ${mode === m.key ? C.green : C.border}`,
                      background: mode === m.key ? C.greenDim : "transparent",
                      color: mode === m.key ? C.green : C.muted,
                      fontSize: 12, fontWeight: 600,
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Episode Selection */}
            <div>
              <label style={{ fontSize: 12, color: C.muted, marginBottom: 6, display: "block" }}>选择集数</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                <button
                  onClick={() => setSelectedEpisodes(Array.from({ length: totalEpisodes }, (_, i) => i + 1))}
                  style={{ padding: "4px 8px", borderRadius: 5, cursor: "pointer", border: `1px solid ${C.border}`, background: "transparent", color: C.muted, fontSize: 11 }}
                >
                  全选
                </button>
                <button
                  onClick={() => setSelectedEpisodes([])}
                  style={{ padding: "4px 8px", borderRadius: 5, cursor: "pointer", border: `1px solid ${C.border}`, background: "transparent", color: C.muted, fontSize: 11 }}
                >
                  清空
                </button>
                {Array.from({ length: totalEpisodes }, (_, i) => i + 1).map(ep => (
                  <button
                    key={ep}
                    onClick={() => toggleEpisode(ep)}
                    style={{
                      width: 32, height: 28, borderRadius: 5, cursor: "pointer",
                      border: `1px solid ${selectedEpisodes.includes(ep) ? C.green : C.border}`,
                      background: selectedEpisodes.includes(ep) ? C.greenDim : "transparent",
                      color: selectedEpisodes.includes(ep) ? C.green : C.muted,
                      fontSize: 11, fontWeight: 600,
                    }}
                  >
                    {ep}
                  </button>
                ))}
              </div>
            </div>

            {/* Skip Existing */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                onClick={() => setSkipExisting(!skipExisting)}
                style={{
                  width: 20, height: 20, borderRadius: 4, cursor: "pointer",
                  border: `2px solid ${skipExisting ? C.green : C.border}`,
                  background: skipExisting ? C.green : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                {skipExisting && <Check size={12} style={{ color: "oklch(0.08 0.005 240)" }} />}
              </button>
              <span style={{ fontSize: 12, color: C.muted }}>跳过已有内容（不重新生成）</span>
            </div>

            {/* Video Engine (only when mode includes video) */}
            {(mode === "video" || mode === "both") && (
              <div>
                <label style={{ fontSize: 12, color: C.muted, marginBottom: 6, display: "block" }}>视频模型</label>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {[
                    { key: "seedance_1_5", label: "Seedance 1.5 Pro" },
                    { key: "kling_3_0", label: "Kling 3.0" },
                    { key: "veo_3_1", label: "Veo 3.1" },
                    { key: "wan2_6", label: "Wan 2.6" },
                  ].map(e => (
                    <button key={e.key} onClick={() => setBatchVideoEngine(e.key)}
                      style={{ padding: "6px 10px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600,
                        border: `1px solid ${batchVideoEngine === e.key ? C.green : C.border}`,
                        background: batchVideoEngine === e.key ? C.greenDim : "transparent",
                        color: batchVideoEngine === e.key ? C.green : C.muted,
                      }}>{e.label}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Duration (only when mode includes video) */}
            {(mode === "video" || mode === "both") && (
              <div>
                <label style={{ fontSize: 12, color: C.muted, marginBottom: 6, display: "block" }}>视频时长</label>
                <div style={{ display: "flex", gap: 4 }}>
                  {[4, 5, 6, 8, 10].map(d => (
                    <button key={d} onClick={() => setBatchDuration(d)}
                      style={{ flex: 1, padding: "6px 0", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600,
                        border: `1px solid ${batchDuration === d ? C.green : C.border}`,
                        background: batchDuration === d ? C.greenDim : "transparent",
                        color: batchDuration === d ? C.green : C.muted,
                      }}>{d}s</button>
                  ))}
                </div>
              </div>
            )}

            {/* Info */}
            <div style={{ background: "oklch(0.75 0.17 65 / 0.1)", border: `1px solid oklch(0.75 0.17 65 / 0.3)`, borderRadius: 8, padding: "10px 12px" }}>
              <p style={{ fontSize: 11, color: C.amber }}>
                ⚡ 一键跑量将自动为所选集数的所有镜头生成首帧图片和视频，每集约需 5-15 分钟。
                请确保已先完成「自动生成提示词」步骤。
              </p>
            </div>
          </div>
        )}

        {!running && (
          <DialogFooter>
            <Button variant="outline" onClick={onClose} style={{ borderColor: C.border, color: C.muted }}>取消</Button>
            <Button
              onClick={handleRun}
              disabled={selectedEpisodes.length === 0}
              style={{ background: C.green, color: "oklch(0.08 0.005 240)", fontWeight: 700 }}
            >
              <Zap size={14} /> 开始跑量（{selectedEpisodes.length} 集）
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
