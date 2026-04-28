// 精品剧工作台 — 项目定义 / 智能分集 / 资产库 / 分镜草图 / Seedance 2.0 生成

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import {
  ArrowLeft,
  Boxes,
  Camera,
  Check,
  ChevronLeft,
  Clapperboard,
  Copy,
  Download,
  FileText,
  Film,
  ImageIcon,
  Layers,
  Loader2,
  MapPin,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  User,
  Wand2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MARKET_OPTIONS } from "@shared/videoModels";

const C = {
  bg: "oklch(0.11 0.006 245)",
  panel: "oklch(0.145 0.008 245)",
  panel2: "oklch(0.18 0.009 245)",
  line: "oklch(0.25 0.01 245)",
  line2: "oklch(0.34 0.014 245)",
  text: "oklch(0.93 0.006 70)",
  sub: "oklch(0.70 0.01 245)",
  dim: "oklch(0.48 0.012 245)",
  gold: "oklch(0.78 0.15 75)",
  green: "oklch(0.72 0.18 155)",
  blue: "oklch(0.68 0.15 235)",
  rose: "oklch(0.68 0.19 20)",
  violet: "oklch(0.68 0.16 300)",
};

type OverseasProject = {
  id: number;
  name: string;
  definition: string | null;
  market: string;
  aspectRatio: "landscape" | "portrait";
  style: "realistic" | "animation" | "cg";
  genre: string;
  totalEpisodes: number | null;
  status: "draft" | "in_progress" | "completed";
  imageEngine: string | null;
  videoEngine: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type AssetType = "character" | "scene" | "prop" | "costume" | "storyboard" | "camera_diagram" | "custom";

type OverseasAsset = {
  id: number;
  projectId: number;
  type: AssetType;
  name: string;
  description: string | null;
  mjPrompt: string | null;
  stylePrompt: string | null;
  referenceImageUrl: string | null;
  mainImageUrl: string | null;
  mjImageUrl: string | null;
  viewCloseUpUrl: string | null;
  multiAngleGridUrl: string | null;
  tags: string | null;
  createdAt: Date;
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
  storyboardPrompt: string | null;
  storyboardSketchUrl: string | null;
  cameraDiagramPrompt: string | null;
  cameraDiagramUrl: string | null;
  videoPrompt: string | null;
  videoUrl: string | null;
  subjectRefUrls: string | null;
  videoDuration: number | null;
  status: "draft" | "generating_frame" | "frame_done" | "generating_video" | "done" | "failed";
  errorMessage: string | null;
};

type SplitEpisode = {
  episodeNumber: number;
  title: string;
  scriptText: string;
};

type WorkspaceTab = "definition" | "script" | "assets" | "storyboard" | "video";

const assetTypeLabel: Record<AssetType, string> = {
  character: "人物角色",
  scene: "场景",
  prop: "道具",
  costume: "服化道",
  storyboard: "分镜草图",
  camera_diagram: "机位图",
  custom: "自定义",
};

const assetTypeIcon: Record<AssetType, ReactNode> = {
  character: <User size={14} />,
  scene: <MapPin size={14} />,
  prop: <Boxes size={14} />,
  costume: <Layers size={14} />,
  storyboard: <ImageIcon size={14} />,
  camera_diagram: <Camera size={14} />,
  custom: <Upload size={14} />,
};

const tabList: Array<{ key: WorkspaceTab; label: string; icon: ReactNode }> = [
  { key: "definition", label: "项目定义", icon: <Pencil size={14} /> },
  { key: "script", label: "智能分集", icon: <FileText size={14} /> },
  { key: "assets", label: "资产库", icon: <Boxes size={14} /> },
  { key: "storyboard", label: "分镜草图", icon: <ImageIcon size={14} /> },
  { key: "video", label: "视频生成", icon: <Play size={14} /> },
];

function panelStyle(extra: CSSProperties = {}): CSSProperties {
  return {
    background: C.panel,
    border: `1px solid ${C.line}`,
    borderRadius: 8,
    ...extra,
  };
}

function fieldStyle(): CSSProperties {
  return {
    background: C.bg,
    border: `1px solid ${C.line}`,
    color: C.text,
  };
}

function pickAssetImage(asset: OverseasAsset): string | null {
  return asset.referenceImageUrl || asset.viewCloseUpUrl || asset.mainImageUrl || asset.multiAngleGridUrl || asset.mjImageUrl || null;
}

async function copyText(text?: string | null) {
  if (!text) return;
  await navigator.clipboard.writeText(text);
  toast.success("已复制");
}

async function uploadToS3(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/upload-asset-s3", { method: "POST", body: form, credentials: "include" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "上传失败");
  return data.url as string;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function EmptyState({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div style={{ padding: 48, textAlign: "center", color: C.dim }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 13 }}>{title}</div>
    </div>
  );
}

export default function OverseasWorkflow() {
  const { isAuthenticated, loading } = useAuth();
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "grid", placeItems: "center" }}>
        <Loader2 className="animate-spin" style={{ color: C.gold }} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "grid", placeItems: "center" }}>
        <div style={{ ...panelStyle({ width: 360, padding: 28, textAlign: "center" }) }}>
          <Clapperboard size={36} style={{ color: C.gold, margin: "0 auto 14px" }} />
          <div style={{ color: C.text, fontSize: 18, fontWeight: 700, marginBottom: 8 }}>鎏光机精品剧</div>
          <Button onClick={() => { window.location.href = getLoginUrl(); }} style={{ background: C.gold, color: C.bg, fontWeight: 700 }}>
            登录
          </Button>
        </div>
      </div>
    );
  }

  if (!activeProjectId) {
    return <ProjectDashboard onOpen={setActiveProjectId} />;
  }

  return <ProjectWorkspace projectId={activeProjectId} onBack={() => setActiveProjectId(null)} />;
}

function ProjectDashboard({ onOpen }: { onOpen: (id: number) => void }) {
  const [createOpen, setCreateOpen] = useState(false);
  const { data: projects = [], refetch } = trpc.overseas.listProjects.useQuery();
  const rows = projects as OverseasProject[];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, padding: 32 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 26 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Film size={22} style={{ color: C.gold }} />
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>鎏光机精品剧</h1>
          </div>
          <div style={{ color: C.sub, fontSize: 13, marginTop: 6 }}>Seedance 2.0 多参考视频工作台</div>
        </div>
        <Button onClick={() => setCreateOpen(true)} style={{ background: C.gold, color: C.bg, fontWeight: 800, gap: 6 }}>
          <Plus size={15} /> 新建精品剧
        </Button>
      </div>

      {rows.length === 0 ? (
        <div style={panelStyle({ minHeight: 320, display: "grid", placeItems: "center" })}>
          <EmptyState icon={<Clapperboard size={42} />} title="还没有精品剧项目" />
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          {rows.map((project) => (
            <ProjectCard key={project.id} project={project} onOpen={() => onOpen(project.id)} onDeleted={refetch} />
          ))}
        </div>
      )}

      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={(id) => { setCreateOpen(false); onOpen(id); }} />
    </div>
  );
}

function ProjectCard({ project, onOpen, onDeleted }: { project: OverseasProject; onOpen: () => void; onDeleted: () => void }) {
  const deleteProject = trpc.overseas.deleteProject.useMutation({
    onSuccess: () => { toast.success("项目已删除"); onDeleted(); },
    onError: (e) => toast.error(e.message),
  });
  const market = MARKET_OPTIONS.find((m) => m.value === project.market)?.label ?? project.market;

  return (
    <button
      onClick={onOpen}
      style={{
        ...panelStyle({ padding: 18, cursor: "pointer", textAlign: "left" }),
        minHeight: 150,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ color: C.text, fontSize: 15, fontWeight: 800, marginBottom: 6 }}>{project.name}</div>
          <div style={{ color: C.sub, fontSize: 12 }}>{market} · {project.aspectRatio === "portrait" ? "9:16" : "16:9"} · {project.totalEpisodes ?? 1} 集</div>
        </div>
        <span
          onClick={(e) => { e.stopPropagation(); if (confirm("确认删除此项目？")) deleteProject.mutate({ id: project.id }); }}
          style={{ color: C.dim, padding: 4 }}
        >
          <Trash2 size={14} />
        </span>
      </div>
      <div style={{ color: C.dim, fontSize: 12, lineHeight: 1.6, marginTop: 16, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {project.definition || "未填写项目定义"}
      </div>
    </button>
  );
}

function CreateProjectDialog({ open, onOpenChange, onCreated }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: number) => void;
}) {
  const [form, setForm] = useState({
    name: "",
    definition: "",
    market: "cn",
    aspectRatio: "portrait" as "portrait" | "landscape",
    style: "realistic" as "realistic" | "animation" | "cg",
    genre: "drama",
    totalEpisodes: 12,
  });
  const createProject = trpc.overseas.createProject.useMutation({
    onSuccess: (project) => { toast.success("精品剧项目已创建"); onCreated(project.id); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.text, maxWidth: 560 }}>
        <DialogHeader>
          <DialogTitle>新建精品剧</DialogTitle>
        </DialogHeader>
        <div style={{ display: "grid", gap: 12 }}>
          <Input placeholder="项目名称" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={fieldStyle()} />
          <Textarea placeholder="项目定义：核心设定、目标观众、视觉风格、制作约束" value={form.definition} onChange={(e) => setForm((f) => ({ ...f, definition: e.target.value }))} rows={4} style={fieldStyle()} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Select value={form.market} onValueChange={(market) => setForm((f) => ({ ...f, market }))}>
              <SelectTrigger style={fieldStyle()}><SelectValue /></SelectTrigger>
              <SelectContent>
                {MARKET_OPTIONS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={form.aspectRatio} onValueChange={(aspectRatio) => setForm((f) => ({ ...f, aspectRatio: aspectRatio as "portrait" | "landscape" }))}>
              <SelectTrigger style={fieldStyle()}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="portrait">竖屏 9:16</SelectItem>
                <SelectItem value="landscape">横屏 16:9</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Select value={form.style} onValueChange={(style) => setForm((f) => ({ ...f, style: style as "realistic" | "animation" | "cg" }))}>
              <SelectTrigger style={fieldStyle()}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="realistic">真人写实</SelectItem>
                <SelectItem value="animation">二维动画</SelectItem>
                <SelectItem value="cg">CG 电影</SelectItem>
              </SelectContent>
            </Select>
            <Input type="number" min={1} max={100} value={form.totalEpisodes} onChange={(e) => setForm((f) => ({ ...f, totalEpisodes: Number(e.target.value) || 1 }))} style={fieldStyle()} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} style={{ borderColor: C.line, color: C.sub }}>取消</Button>
          <Button
            disabled={!form.name.trim() || createProject.isPending}
            onClick={() => createProject.mutate({ ...form, projectType: "premium" })}
            style={{ background: C.gold, color: C.bg, fontWeight: 800 }}
          >
            {createProject.isPending ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />} 创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProjectWorkspace({ projectId, onBack }: { projectId: number; onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("definition");
  const [activeEpisode, setActiveEpisode] = useState(1);
  const { data, refetch } = trpc.overseas.getProject.useQuery({ id: projectId });
  const project = data?.project as OverseasProject | undefined;
  const shots = (data?.shots ?? []) as ScriptShot[];
  const maxEpisode = Math.max(project?.totalEpisodes ?? 1, ...shots.map((s) => s.episodeNumber), 1);

  if (!project) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "grid", placeItems: "center" }}>
        <Loader2 className="animate-spin" style={{ color: C.gold }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, display: "flex", flexDirection: "column" }}>
      <div style={{ height: 58, background: C.panel, borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBack} style={{ color: C.sub, background: "transparent", border: "none", display: "flex", gap: 5, alignItems: "center", cursor: "pointer" }}>
            <ChevronLeft size={16} /> 返回
          </button>
          <div style={{ width: 1, height: 20, background: C.line }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 800 }}>{project.name}</div>
            <div style={{ color: C.dim, fontSize: 11 }}>Seedance 2.0 · 多参考文生视频</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, background: C.bg, padding: 4, borderRadius: 8 }}>
          {tabList.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                border: "none",
                borderRadius: 6,
                padding: "7px 12px",
                display: "flex",
                gap: 6,
                alignItems: "center",
                cursor: "pointer",
                background: activeTab === tab.key ? C.gold : "transparent",
                color: activeTab === tab.key ? C.bg : C.sub,
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>
      </div>

      <main style={{ flex: 1, minHeight: 0 }}>
        {activeTab === "definition" && <DefinitionTab project={project} onSaved={refetch} />}
        {activeTab === "script" && <ScriptSplitTab project={project} activeEpisode={activeEpisode} onEpisodeChange={setActiveEpisode} onChanged={refetch} />}
        {activeTab === "assets" && <AssetLibraryTab project={project} />}
        {activeTab === "storyboard" && <StoryboardTab project={project} activeEpisode={activeEpisode} maxEpisode={maxEpisode} onEpisodeChange={setActiveEpisode} />}
        {activeTab === "video" && <VideoGenerationTab project={project} activeEpisode={activeEpisode} maxEpisode={maxEpisode} onEpisodeChange={setActiveEpisode} />}
      </main>
    </div>
  );
}

function DefinitionTab({ project, onSaved }: { project: OverseasProject; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: project.name,
    definition: project.definition ?? "",
    market: project.market,
    aspectRatio: project.aspectRatio,
    style: project.style,
    genre: project.genre,
    totalEpisodes: project.totalEpisodes ?? 1,
  });
  const updateProject = trpc.overseas.updateProject.useMutation({
    onSuccess: () => { toast.success("项目定义已保存"); onSaved(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div style={{ padding: 22, display: "grid", gridTemplateColumns: "minmax(360px, 680px) 1fr", gap: 18 }}>
      <section style={panelStyle({ padding: 18 })}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <Pencil size={16} style={{ color: C.gold }} />
          <h2 style={{ margin: 0, fontSize: 16 }}>项目定义</h2>
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={fieldStyle()} />
          <Textarea value={form.definition} onChange={(e) => setForm((f) => ({ ...f, definition: e.target.value }))} rows={10} style={fieldStyle()} placeholder="一句话故事、人物关系、视觉风格、禁忌项、目标成片规格" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Select value={form.market} onValueChange={(market) => setForm((f) => ({ ...f, market }))}>
              <SelectTrigger style={fieldStyle()}><SelectValue /></SelectTrigger>
              <SelectContent>{MARKET_OPTIONS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={form.aspectRatio} onValueChange={(aspectRatio) => setForm((f) => ({ ...f, aspectRatio: aspectRatio as "portrait" | "landscape" }))}>
              <SelectTrigger style={fieldStyle()}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="portrait">9:16</SelectItem>
                <SelectItem value="landscape">16:9</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Select value={form.style} onValueChange={(style) => setForm((f) => ({ ...f, style: style as "realistic" | "animation" | "cg" }))}>
              <SelectTrigger style={fieldStyle()}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="realistic">真人写实</SelectItem>
                <SelectItem value="animation">二维动画</SelectItem>
                <SelectItem value="cg">CG 电影</SelectItem>
              </SelectContent>
            </Select>
            <Input type="number" value={form.totalEpisodes} min={1} max={100} onChange={(e) => setForm((f) => ({ ...f, totalEpisodes: Number(e.target.value) || 1 }))} style={fieldStyle()} />
          </div>
          <Button
            onClick={() => updateProject.mutate({ id: project.id, ...form, projectType: "premium", videoEngine: "seedance_2_0" })}
            disabled={updateProject.isPending}
            style={{ background: C.gold, color: C.bg, fontWeight: 800, justifySelf: "start", gap: 6 }}
          >
            {updateProject.isPending ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />} 保存定义
          </Button>
        </div>
      </section>
      <section style={panelStyle({ padding: 18 })}>
        <div style={{ color: C.sub, fontSize: 12, lineHeight: 1.8 }}>
          <div style={{ color: C.gold, fontWeight: 800, marginBottom: 10 }}>当前生成链路</div>
          <div>剧本智能分集 → 资产提示词 → 分镜简笔草图 → 15 秒视频提示词 → 人物调度/机位图 → Seedance 2.0 多参考生成</div>
        </div>
      </section>
    </div>
  );
}

function ScriptSplitTab({ project, activeEpisode, onEpisodeChange, onChanged }: {
  project: OverseasProject;
  activeEpisode: number;
  onEpisodeChange: (episode: number) => void;
  onChanged: () => void;
}) {
  const utils = trpc.useUtils();
  const [scriptText, setScriptText] = useState("");
  const [episodes, setEpisodes] = useState<SplitEpisode[]>([]);
  const [jobId, setJobId] = useState<number | null>(null);
  const splitScript = trpc.overseas.splitScriptIntoEpisodes.useMutation({
    onSuccess: (data) => {
      setEpisodes(data.episodes);
      toast.success(`已拆出 ${data.episodes.length} 集`);
    },
    onError: (e) => toast.error(e.message),
  });
  const batchParse = trpc.overseas.batchParseScripts.useMutation({
    onSuccess: (data) => {
      setJobId(data.jobId);
      toast.info("分镜设计生成中");
    },
    onError: (e) => toast.error(e.message),
  });
  const analyzeAssets = trpc.overseas.analyzeScriptFull.useMutation({
    onSuccess: (data) => toast.success(`资产识别完成：新增 ${data.addedCount} 个`),
    onError: (e) => toast.error(e.message),
  });
  const { data: job } = trpc.overseas.getBatchJob.useQuery(
    { jobId: jobId! },
    { enabled: jobId !== null, refetchInterval: jobId ? 2500 : false }
  );

  useEffect(() => {
    if (!job || job.status !== "done") return;
    toast.success(`分镜设计完成：${job.succeeded}/${job.total}`);
    setJobId(null);
    utils.overseas.getProject.invalidate({ id: project.id });
    utils.overseas.listShots.invalidate();
    onChanged();
  }, [job, onChanged, project.id, utils]);

  const startStoryboard = () => {
    const sourceEpisodes = episodes.length > 0
      ? episodes
      : [{ episodeNumber: activeEpisode, title: `第 ${activeEpisode} 集`, scriptText }];
    if (sourceEpisodes.some((ep) => ep.scriptText.trim().length < 10)) {
      toast.error("剧本文本不足");
      return;
    }
    batchParse.mutate({
      projectId: project.id,
      scripts: sourceEpisodes.map((ep) => ({ episodeNumber: ep.episodeNumber, scriptText: ep.scriptText })),
      language: project.market === "cn" ? "zh" : "en",
    });
    analyzeAssets.mutate({ projectId: project.id, scriptText: sourceEpisodes.map((ep) => `第${ep.episodeNumber}集\n${ep.scriptText}`).join("\n\n") });
  };

  return (
    <div style={{ padding: 22, display: "grid", gridTemplateColumns: "minmax(420px, 1fr) minmax(360px, 520px)", gap: 18, height: "calc(100vh - 58px)" }}>
      <section style={panelStyle({ padding: 18, display: "flex", flexDirection: "column", minHeight: 0 })}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><FileText size={16} style={{ color: C.gold }} /><h2 style={{ margin: 0, fontSize: 16 }}>剧本智能分集</h2></div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="outline" disabled={splitScript.isPending || !scriptText.trim()} onClick={() => splitScript.mutate({ projectId: project.id, scriptText, targetEpisodes: project.totalEpisodes ?? undefined })} style={{ borderColor: C.line, color: C.sub, gap: 6 }}>
              {splitScript.isPending ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />} 智能分集
            </Button>
            <Button disabled={batchParse.isPending || !!jobId || (!scriptText.trim() && episodes.length === 0)} onClick={startStoryboard} style={{ background: C.gold, color: C.bg, fontWeight: 800, gap: 6 }}>
              {batchParse.isPending || jobId ? <Loader2 className="animate-spin" size={14} /> : <Wand2 size={14} />} 生成分镜设计
            </Button>
          </div>
        </div>
        <Textarea
          value={scriptText}
          onChange={(e) => setScriptText(e.target.value)}
          placeholder="粘贴完整剧本；已有第X集标记时会按标记切分"
          style={{ ...fieldStyle(), flex: 1, minHeight: 360, resize: "none", lineHeight: 1.65 }}
        />
        {jobId && job && (
          <div style={{ marginTop: 12, color: C.sub, fontSize: 12 }}>
            {job.currentName} · {job.current}/{job.total}
          </div>
        )}
      </section>
      <section style={panelStyle({ padding: 18, overflow: "auto" })}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}><Layers size={16} style={{ color: C.blue }} /><h2 style={{ margin: 0, fontSize: 16 }}>分集结果</h2></div>
        {episodes.length === 0 ? (
          <EmptyState icon={<FileText size={34} />} title="暂无分集结果" />
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {episodes.map((ep) => (
              <button key={ep.episodeNumber} onClick={() => onEpisodeChange(ep.episodeNumber)} style={{ ...panelStyle({ padding: 12, textAlign: "left", cursor: "pointer", background: activeEpisode === ep.episodeNumber ? "oklch(0.21 0.03 75)" : C.panel2 }) }}>
                <div style={{ color: C.text, fontWeight: 800, fontSize: 13 }}>第 {ep.episodeNumber} 集 · {ep.title}</div>
                <div style={{ color: C.dim, fontSize: 12, marginTop: 6, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{ep.scriptText}</div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function AssetLibraryTab({ project }: { project: OverseasProject }) {
  const utils = trpc.useUtils();
  const [addOpen, setAddOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "character" | "asset">("all");
  const { data = [], refetch } = trpc.overseas.listAssets.useQuery({ projectId: project.id });
  const assets = data as OverseasAsset[];
  const promptMutation = trpc.overseas.batchGenerateAssetPrompts.useMutation({
    onSuccess: (data) => { toast.success(`资产提示词已生成：${data.generated}/${data.total}`); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteAsset = trpc.overseas.deleteAsset.useMutation({
    onSuccess: () => { toast.success("资产已删除"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const uploadAsset = trpc.overseas.uploadAssetToS3.useMutation({
    onSuccess: () => { toast.success("参考图已写入资产库"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const rows = assets.filter((asset) => {
    if (filter === "character") return asset.type === "character";
    if (filter === "asset") return asset.type !== "character";
    return true;
  });

  const uploadExisting = async (asset: OverseasAsset, file: File) => {
    const fileBase64 = await fileToBase64(file);
    uploadAsset.mutate({ assetId: asset.id, field: "referenceImageUrl", fileBase64, contentType: file.type || "image/png", fileName: file.name });
  };

  return (
    <div style={{ padding: 22, height: "calc(100vh - 58px)", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Boxes size={17} style={{ color: C.gold }} /><h2 style={{ margin: 0, fontSize: 16 }}>资产库</h2></div>
        <div style={{ display: "flex", gap: 8 }}>
          {(["all", "character", "asset"] as const).map((key) => (
            <button key={key} onClick={() => setFilter(key)} style={{ border: `1px solid ${filter === key ? C.gold : C.line}`, background: filter === key ? "oklch(0.23 0.035 75)" : C.panel, color: filter === key ? C.gold : C.sub, borderRadius: 6, padding: "7px 10px", cursor: "pointer", fontSize: 12 }}>
              {key === "all" ? "全部" : key === "character" ? "人物角色" : "资产"}
            </button>
          ))}
          <Button variant="outline" disabled={promptMutation.isPending || assets.length === 0} onClick={() => promptMutation.mutate({ projectId: project.id })} style={{ borderColor: C.line, color: C.sub, gap: 6 }}>
            {promptMutation.isPending ? <Loader2 className="animate-spin" size={14} /> : <Wand2 size={14} />} 生成资产提示词
          </Button>
          <Button onClick={() => setAddOpen(true)} style={{ background: C.gold, color: C.bg, fontWeight: 800, gap: 6 }}><Plus size={14} /> 新增</Button>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        {rows.length === 0 ? (
          <div style={panelStyle({ height: "100%", display: "grid", placeItems: "center" })}>
            <EmptyState icon={<Boxes size={36} />} title="暂无资产" />
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: 12 }}>
            {rows.map((asset) => {
              const imageUrl = pickAssetImage(asset);
              const prompt = asset.mjPrompt || asset.stylePrompt;
              return (
                <article key={asset.id} style={panelStyle({ overflow: "hidden" })}>
                  <div style={{ height: 138, background: C.bg, borderBottom: `1px solid ${C.line}`, display: "grid", placeItems: "center" }}>
                    {imageUrl ? <img src={imageUrl} alt={asset.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <ImageIcon size={28} style={{ color: C.dim }} />}
                  </div>
                  <div style={{ padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: C.text, fontSize: 13, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{asset.name}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, color: C.dim, fontSize: 11, marginTop: 3 }}>{assetTypeIcon[asset.type]} {assetTypeLabel[asset.type]}</div>
                      </div>
                      <button onClick={() => { if (confirm("删除这个资产？")) deleteAsset.mutate({ id: asset.id }); }} style={{ border: "none", background: "transparent", color: C.dim, cursor: "pointer" }}><Trash2 size={14} /></button>
                    </div>
                    <div style={{ color: C.sub, fontSize: 12, lineHeight: 1.5, minHeight: 36, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{asset.description || "未填写描述"}</div>
                    {prompt && (
                      <div style={{ color: C.dim, fontSize: 11, lineHeight: 1.5, marginTop: 10, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {prompt}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                      <Button variant="outline" size="sm" onClick={() => copyText(prompt)} disabled={!prompt} style={{ borderColor: C.line, color: C.sub, gap: 5 }}><Copy size={12} /> 提示词</Button>
                      <label style={{ border: `1px solid ${C.line}`, color: C.sub, borderRadius: 6, padding: "6px 9px", fontSize: 12, display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
                        <Upload size={12} /> 参考图
                        <input type="file" accept="image/*" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadExisting(asset, file); e.currentTarget.value = ""; }} />
                      </label>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
      <AddAssetDialog open={addOpen} onOpenChange={setAddOpen} projectId={project.id} onCreated={() => { setAddOpen(false); utils.overseas.listAssets.invalidate({ projectId: project.id }); refetch(); }} />
    </div>
  );
}

function AddAssetDialog({ open, onOpenChange, projectId, onCreated }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({ type: "custom" as AssetType, name: "", description: "", file: null as File | null });
  const [uploading, setUploading] = useState(false);
  const createAsset = trpc.overseas.createAsset.useMutation({
    onSuccess: () => { toast.success("资产已添加"); onCreated(); },
    onError: (e) => toast.error(e.message),
  });

  const submit = async () => {
    if (!form.name.trim()) { toast.error("请输入资产名称"); return; }
    setUploading(true);
    try {
      const referenceImageUrl = form.file ? await uploadToS3(form.file) : undefined;
      createAsset.mutate({ projectId, type: form.type, name: form.name, description: form.description, referenceImageUrl });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "上传失败");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.text, maxWidth: 520 }}>
        <DialogHeader><DialogTitle>新增资产</DialogTitle></DialogHeader>
        <div style={{ display: "grid", gap: 12 }}>
          <Select value={form.type} onValueChange={(type) => setForm((f) => ({ ...f, type: type as AssetType }))}>
            <SelectTrigger style={fieldStyle()}><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(assetTypeLabel).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="名称" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={fieldStyle()} />
          <Textarea placeholder="描述" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={4} style={fieldStyle()} />
          <label style={{ ...panelStyle({ padding: 14, display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }), color: C.sub }}>
            <Upload size={16} style={{ color: C.gold }} />
            <span style={{ fontSize: 13 }}>{form.file ? form.file.name : "上传用户自制参考图"}</span>
            <input type="file" hidden accept="image/*" onChange={(e) => setForm((f) => ({ ...f, file: e.target.files?.[0] ?? null }))} />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} style={{ borderColor: C.line, color: C.sub }}>取消</Button>
          <Button disabled={uploading || createAsset.isPending} onClick={submit} style={{ background: C.gold, color: C.bg, fontWeight: 800 }}>
            {uploading || createAsset.isPending ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />} 添加
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EpisodeSelector({ activeEpisode, maxEpisode, onEpisodeChange }: {
  activeEpisode: number;
  maxEpisode: number;
  onEpisodeChange: (episode: number) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      {Array.from({ length: maxEpisode }, (_, i) => i + 1).map((episode) => (
        <button
          key={episode}
          onClick={() => onEpisodeChange(episode)}
          style={{
            width: 34,
            height: 30,
            borderRadius: 6,
            border: `1px solid ${activeEpisode === episode ? C.gold : C.line}`,
            background: activeEpisode === episode ? "oklch(0.23 0.035 75)" : C.panel,
            color: activeEpisode === episode ? C.gold : C.sub,
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          {episode}
        </button>
      ))}
    </div>
  );
}

function ShotList({ shots, activeShotId, onSelect }: { shots: ScriptShot[]; activeShotId: number | null; onSelect: (id: number) => void }) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {shots.map((shot) => (
        <button
          key={shot.id}
          onClick={() => onSelect(shot.id)}
          style={{ ...panelStyle({ padding: 10, textAlign: "left", cursor: "pointer", background: activeShotId === shot.id ? "oklch(0.21 0.03 75)" : C.panel2 }) }}
        >
          <div style={{ color: C.text, fontWeight: 800, fontSize: 12 }}>镜头 {shot.episodeNumber}.{shot.shotNumber} · {shot.shotType || "未设景别"}</div>
          <div style={{ color: C.dim, fontSize: 11, marginTop: 5, lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{shot.visualDescription}</div>
        </button>
      ))}
    </div>
  );
}

function StoryboardTab({ project, activeEpisode, maxEpisode, onEpisodeChange }: {
  project: OverseasProject;
  activeEpisode: number;
  maxEpisode: number;
  onEpisodeChange: (episode: number) => void;
}) {
  const [activeShotId, setActiveShotId] = useState<number | null>(null);
  const [runningAll, setRunningAll] = useState(false);
  const { data = [], refetch } = trpc.overseas.listShots.useQuery({ projectId: project.id, episodeNumber: activeEpisode });
  const shots = data as ScriptShot[];
  const activeShot = shots.find((s) => s.id === activeShotId) || shots[0] || null;
  const generateSketch = trpc.overseas.generateStoryboardSketch.useMutation({
    onSuccess: () => { toast.success("分镜草图已生成"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const addVisual = trpc.overseas.addShotVisualToAssetLibrary.useMutation({
    onSuccess: () => toast.success("已加入资产库"),
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => { setActiveShotId(null); }, [activeEpisode]);

  const generateAll = async () => {
    if (shots.length === 0) return;
    setRunningAll(true);
    try {
      for (const shot of shots) {
        if (!shot.storyboardSketchUrl) {
          await generateSketch.mutateAsync({ shotId: shot.id, imageEngine: "image2", addToAssetLibrary: false });
        }
      }
      toast.success("本集分镜草图已完成");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "生成失败");
    } finally {
      setRunningAll(false);
    }
  };

  return (
    <div style={{ padding: 22, height: "calc(100vh - 58px)", display: "grid", gridTemplateColumns: "260px minmax(420px, 1fr) 360px", gap: 14 }}>
      <aside style={panelStyle({ padding: 12, overflow: "auto" })}>
        <EpisodeSelector activeEpisode={activeEpisode} maxEpisode={maxEpisode} onEpisodeChange={onEpisodeChange} />
        <div style={{ height: 12 }} />
        {shots.length === 0 ? <EmptyState icon={<ImageIcon size={30} />} title="本集暂无分镜" /> : <ShotList shots={shots} activeShotId={activeShot?.id ?? null} onSelect={setActiveShotId} />}
      </aside>
      <section style={panelStyle({ display: "grid", placeItems: "center", overflow: "hidden" })}>
        {activeShot?.storyboardSketchUrl ? (
          <img src={activeShot.storyboardSketchUrl} alt="分镜草图" style={{ width: "100%", height: "100%", objectFit: "contain", background: C.bg }} />
        ) : (
          <EmptyState icon={<ImageIcon size={44} />} title="当前镜头没有草图" />
        )}
      </section>
      <aside style={panelStyle({ padding: 14, overflow: "auto" })}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 15 }}>分镜设计</h2>
          <Button variant="outline" disabled={runningAll || shots.length === 0} onClick={generateAll} style={{ borderColor: C.line, color: C.sub, gap: 5 }}>
            {runningAll ? <Loader2 className="animate-spin" size={13} /> : <RefreshCw size={13} />} 本集
          </Button>
        </div>
        {activeShot ? (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ color: C.sub, fontSize: 12, lineHeight: 1.65 }}>{activeShot.visualDescription}</div>
            <Textarea value={activeShot.storyboardPrompt || ""} readOnly rows={7} style={{ ...fieldStyle(), fontSize: 12 }} placeholder="草图提示词会在生成后写入" />
            <Button disabled={generateSketch.isPending} onClick={() => generateSketch.mutate({ shotId: activeShot.id, imageEngine: "image2", addToAssetLibrary: false })} style={{ background: C.gold, color: C.bg, fontWeight: 800, gap: 6 }}>
              {generateSketch.isPending ? <Loader2 className="animate-spin" size={14} /> : <Wand2 size={14} />} 生成草图
            </Button>
            <Button variant="outline" disabled={!activeShot.storyboardSketchUrl || addVisual.isPending} onClick={() => addVisual.mutate({ shotId: activeShot.id, kind: "storyboard" })} style={{ borderColor: C.line, color: C.sub, gap: 6 }}>
              <Plus size={14} /> 加入资产库
            </Button>
          </div>
        ) : (
          <EmptyState icon={<ImageIcon size={30} />} title="请选择镜头" />
        )}
      </aside>
    </div>
  );
}

function VideoGenerationTab({ project, activeEpisode, maxEpisode, onEpisodeChange }: {
  project: OverseasProject;
  activeEpisode: number;
  maxEpisode: number;
  onEpisodeChange: (episode: number) => void;
}) {
  const [activeShotId, setActiveShotId] = useState<number | null>(null);
  const [selectedAssetIds, setSelectedAssetIds] = useState<number[]>([]);
  const [uploadedRefs, setUploadedRefs] = useState<string[]>([]);
  const [duration, setDuration] = useState(15);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const { data: shotData = [], refetch: refetchShots } = trpc.overseas.listShots.useQuery({ projectId: project.id, episodeNumber: activeEpisode });
  const { data: assetData = [] } = trpc.overseas.listAssets.useQuery({ projectId: project.id });
  const shots = shotData as ScriptShot[];
  const assets = assetData as OverseasAsset[];
  const activeShot = shots.find((s) => s.id === activeShotId) || shots[0] || null;
  const referenceAssets = assets.filter((asset) => !!pickAssetImage(asset));
  const selectedRefUrls = referenceAssets.filter((asset) => selectedAssetIds.includes(asset.id)).map((asset) => pickAssetImage(asset)!).concat(uploadedRefs).slice(0, 9);

  const promptMutation = trpc.overseas.generatePremiumVideoPrompt.useMutation({
    onSuccess: () => { toast.success("Seedance 2.0 提示词已生成"); refetchShots(); },
    onError: (e) => toast.error(e.message),
  });
  const diagramMutation = trpc.overseas.generateCameraDiagram.useMutation({
    onSuccess: () => { toast.success("机位示意图已生成"); refetchShots(); },
    onError: (e) => toast.error(e.message),
  });
  const addVisual = trpc.overseas.addShotVisualToAssetLibrary.useMutation({
    onSuccess: () => toast.success("已加入资产库"),
    onError: (e) => toast.error(e.message),
  });
  const videoMutation = trpc.overseas.generatePremiumVideo.useMutation({
    onSuccess: () => { toast.success("视频已生成"); refetchShots(); },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    setActiveShotId(null);
    setSelectedAssetIds([]);
    setUploadedRefs([]);
  }, [activeEpisode]);

  const uploadReference = async (file: File) => {
    try {
      const url = await uploadToS3(file);
      setUploadedRefs((prev) => [...prev, url].slice(0, 9));
      toast.success("参考图已添加");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "上传失败");
    }
  };

  const generateVideo = () => {
    if (!activeShot) return;
    const prompt = promptRef.current?.value || activeShot.videoPrompt || "";
    videoMutation.mutate({
      shotId: activeShot.id,
      prompt,
      referenceImageUrls: selectedRefUrls,
      duration,
      aspectRatio: project.aspectRatio === "portrait" ? "9:16" : "16:9",
    });
  };

  return (
    <div style={{ padding: 22, height: "calc(100vh - 58px)", display: "grid", gridTemplateColumns: "250px minmax(420px, 1fr) 420px", gap: 14 }}>
      <aside style={panelStyle({ padding: 12, overflow: "auto" })}>
        <EpisodeSelector activeEpisode={activeEpisode} maxEpisode={maxEpisode} onEpisodeChange={onEpisodeChange} />
        <div style={{ height: 12 }} />
        {shots.length === 0 ? <EmptyState icon={<Film size={30} />} title="本集暂无镜头" /> : <ShotList shots={shots} activeShotId={activeShot?.id ?? null} onSelect={setActiveShotId} />}
      </aside>

      <section style={panelStyle({ overflow: "hidden", display: "grid", gridTemplateRows: "1fr 180px" })}>
        <div style={{ background: C.bg, display: "grid", placeItems: "center", overflow: "hidden" }}>
          {activeShot?.videoUrl ? (
            <video src={activeShot.videoUrl} controls style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          ) : activeShot?.cameraDiagramUrl ? (
            <img src={activeShot.cameraDiagramUrl} alt="机位示意图" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          ) : activeShot?.storyboardSketchUrl ? (
            <img src={activeShot.storyboardSketchUrl} alt="分镜草图" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          ) : (
            <EmptyState icon={<Play size={44} />} title="生成窗口" />
          )}
        </div>
        <div style={{ borderTop: `1px solid ${C.line}`, padding: 12, overflow: "auto" }}>
          <div style={{ color: C.text, fontWeight: 800, fontSize: 13, marginBottom: 6 }}>{activeShot ? `镜头 ${activeShot.episodeNumber}.${activeShot.shotNumber}` : "未选择镜头"}</div>
          <div style={{ color: C.sub, fontSize: 12, lineHeight: 1.55 }}>{activeShot?.visualDescription || "暂无镜头描述"}</div>
        </div>
      </section>

      <aside style={panelStyle({ padding: 14, overflow: "auto" })}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Sparkles size={16} style={{ color: C.gold }} />
          <h2 style={{ margin: 0, fontSize: 15 }}>Seedance 2.0</h2>
        </div>
        {activeShot ? (
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <div style={{ color: C.dim, fontSize: 11, marginBottom: 6 }}>智能多参模式 · @{selectedRefUrls.length}/9</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                {referenceAssets.slice(0, 16).map((asset) => {
                  const url = pickAssetImage(asset)!;
                  const checked = selectedAssetIds.includes(asset.id);
                  return (
                    <button key={asset.id} onClick={() => setSelectedAssetIds((prev) => checked ? prev.filter((id) => id !== asset.id) : [...prev, asset.id].slice(0, 9))} style={{ height: 58, borderRadius: 6, overflow: "hidden", padding: 0, border: `2px solid ${checked ? C.gold : C.line}`, background: C.bg, cursor: "pointer", position: "relative" }} title={asset.name}>
                      <img src={url} alt={asset.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </button>
                  );
                })}
                <label style={{ height: 58, borderRadius: 6, border: `1px dashed ${C.line2}`, display: "grid", placeItems: "center", color: C.dim, cursor: "pointer" }}>
                  <Upload size={16} />
                  <input type="file" accept="image/*" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadReference(file); e.currentTarget.value = ""; }} />
                </label>
              </div>
            </div>

            {uploadedRefs.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {uploadedRefs.map((url, index) => (
                  <button key={url} onClick={() => setUploadedRefs((prev) => prev.filter((_, i) => i !== index))} style={{ width: 44, height: 44, borderRadius: 6, border: `1px solid ${C.line}`, overflow: "hidden", padding: 0, background: C.bg, cursor: "pointer" }}>
                    <img src={url} alt="uploaded ref" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </button>
                ))}
              </div>
            )}

            <div>
              <div style={{ color: C.dim, fontSize: 11, marginBottom: 6 }}>时长</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[8, 10, 12, 15].map((value) => (
                  <button key={value} onClick={() => setDuration(value)} style={{ flex: 1, border: `1px solid ${duration === value ? C.gold : C.line}`, background: duration === value ? "oklch(0.23 0.035 75)" : C.bg, color: duration === value ? C.gold : C.sub, borderRadius: 6, height: 32, cursor: "pointer", fontWeight: 800 }}>
                    {value}s
                  </button>
                ))}
              </div>
            </div>

            <Button disabled={promptMutation.isPending} onClick={() => promptMutation.mutate({ shotId: activeShot.id, referenceAssetIds: selectedAssetIds, duration })} variant="outline" style={{ borderColor: C.line, color: C.sub, gap: 6 }}>
              {promptMutation.isPending ? <Loader2 className="animate-spin" size={14} /> : <Wand2 size={14} />} 生成视频提示词
            </Button>

            <Textarea ref={promptRef} key={activeShot.id + (activeShot.videoPrompt || "")} defaultValue={activeShot.videoPrompt || ""} rows={8} style={{ ...fieldStyle(), fontSize: 12, lineHeight: 1.55 }} placeholder="Seedance 2.0 视频提示词" />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Button disabled={diagramMutation.isPending} onClick={() => diagramMutation.mutate({ shotId: activeShot.id, imageEngine: "image2", addToAssetLibrary: false })} variant="outline" style={{ borderColor: C.line, color: C.sub, gap: 6 }}>
                {diagramMutation.isPending ? <Loader2 className="animate-spin" size={14} /> : <Camera size={14} />} 机位图
              </Button>
              <Button disabled={!activeShot.cameraDiagramUrl || addVisual.isPending} onClick={() => addVisual.mutate({ shotId: activeShot.id, kind: "camera_diagram" })} variant="outline" style={{ borderColor: C.line, color: C.sub, gap: 6 }}>
                <Plus size={14} /> 入库
              </Button>
            </div>

            <Button disabled={videoMutation.isPending} onClick={generateVideo} style={{ background: C.gold, color: C.bg, fontWeight: 900, height: 42, gap: 7 }}>
              {videoMutation.isPending ? <Loader2 className="animate-spin" size={15} /> : <Play size={15} />} 生成视频
            </Button>

            {activeShot.videoUrl && (
              <a href={`/api/download-proxy?url=${encodeURIComponent(activeShot.videoUrl)}&filename=${encodeURIComponent(`ep${activeShot.episodeNumber}-shot${activeShot.shotNumber}.mp4`)}`} style={{ color: C.gold, fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <Download size={13} /> 下载视频
              </a>
            )}
          </div>
        ) : (
          <EmptyState icon={<Play size={30} />} title="请选择镜头" />
        )}
      </aside>
    </div>
  );
}
