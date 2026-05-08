import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Archive,
  ArrowUp,
  AtSign,
  Boxes,
  Camera,
  Check,
  ChevronRight,
  Clapperboard,
  Clock,
  Copy,
  Database,
  FileText,
  Film,
  FolderOpen,
  GalleryHorizontal,
  Home,
  ImageIcon,
  KeyRound,
  Layers,
  Loader2,
  Lock,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Settings2,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";
import {
  STYLE_ENHANCERS,
  VISUAL_STYLE_PRESETS,
  buildVisualStylePrompt,
  getVisualStylePreset,
  validateStyleEnhancers,
} from "@shared/visualStyles";

const C = {
  app: "#f7f7f4",
  side: "#fbfaf7",
  panel: "#ffffff",
  panelSoft: "#f1f0eb",
  line: "#e5e1d8",
  lineStrong: "#d1cabe",
  text: "#26262b",
  sub: "#6f706f",
  dim: "#a3a19b",
  gold: "#a87a2b",
  purple: "#7c5cff",
  purpleSoft: "#f1edff",
  green: "#2f9b68",
  red: "#c84b42",
  ink: "#141414",
};

type Project = {
  id: number;
  name: string;
  definition: string | null;
  market: string;
  aspectRatio: "landscape" | "portrait";
  style: "realistic" | "animation" | "cg";
  genre: string;
  visualStylePreset: string;
  styleEnhancers: string | null;
  visualStylePrompt: string | null;
  projectBible: string | null;
  status: "draft" | "in_progress" | "completed";
};

type AssetType = "character" | "scene" | "prop" | "costume" | "storyboard" | "camera_diagram" | "custom";

type Asset = {
  id: number;
  projectId: number;
  type: AssetType;
  name: string;
  description: string | null;
  stylePrompt: string | null;
  mjPrompt: string | null;
  referenceImageUrl: string | null;
  mainImageUrl: string | null;
  mjImageUrl: string | null;
  styleImageUrl: string | null;
  viewFrontUrl: string | null;
  viewSideUrl: string | null;
  viewBackUrl: string | null;
  viewCloseUpUrl: string | null;
  multiAngleGridUrl: string | null;
  tags: string | null;
  isGlobalRef: boolean;
};

type Shot = {
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

type ModuleKey = "overview" | "definition" | "script" | "rules" | "assets" | "shots" | "records";

type VideoSegment = {
  id: string | number;
  episodeNumber: number;
  segmentNumber: number;
  title?: string | null;
  duration: number;
  prompt?: string | null;
  videoUrl?: string | null;
  status?: "draft" | "prompt_ready" | "generating_video" | "done" | "failed";
  errorMessage?: string | null;
  shotIds?: number[];
  referenceAssetIds?: number[];
  referenceImageUrls?: string[];
  shots: Shot[];
};

const navItems: Array<{ key: ModuleKey; label: string; icon: ReactNode }> = [
  { key: "overview", label: "总览", icon: <Home size={16} /> },
  { key: "definition", label: "项目定义", icon: <Film size={16} /> },
  { key: "script", label: "剧本分集", icon: <FileText size={16} /> },
  { key: "rules", label: "导演规则", icon: <Lock size={16} /> },
  { key: "assets", label: "资产库", icon: <Boxes size={16} /> },
  { key: "shots", label: "镜头工作台", icon: <Clapperboard size={16} /> },
  { key: "records", label: "生成记录", icon: <Archive size={16} /> },
];

const assetLabel: Record<AssetType | "all" | "user_upload" | "video_frame", string> = {
  all: "全部",
  character: "人物",
  scene: "场景",
  costume: "服装",
  prop: "道具",
  storyboard: "分镜草图",
  camera_diagram: "机位图",
  custom: "用户上传",
  user_upload: "用户上传",
  video_frame: "视频帧",
};

function card(style?: CSSProperties): CSSProperties {
  return {
    background: C.panel,
    border: `1px solid ${C.line}`,
    borderRadius: 8,
    boxShadow: "0 1px 2px rgba(20,20,20,0.03)",
    ...style,
  };
}

function field(): CSSProperties {
  return {
    background: "#fff",
    borderColor: C.line,
    color: C.text,
    borderRadius: 8,
  };
}

function tinyLabel(color = C.sub): CSSProperties {
  return { color, fontSize: 12, lineHeight: 1.45 };
}

function pill(active = false): CSSProperties {
  return {
    border: `1px solid ${active ? C.purple : C.line}`,
    background: active ? C.purpleSoft : C.panel,
    color: active ? C.purple : C.sub,
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    lineHeight: 1,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  };
}

function assetImage(asset: Asset) {
  return (
    asset.referenceImageUrl ||
    asset.viewCloseUpUrl ||
    asset.mainImageUrl ||
    asset.multiAngleGridUrl ||
    asset.viewFrontUrl ||
    asset.mjImageUrl ||
    asset.styleImageUrl ||
    null
  );
}

function assetTag(asset: Asset) {
  const prefix = asset.type === "storyboard" ? "分镜" : asset.type === "camera_diagram" ? "机位" : asset.name;
  return `@${prefix.replace(/\s+/g, "")}`;
}

function parseStyleEnhancers(value?: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === "string").slice(0, 5);
  } catch {
    return value.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 5);
  }
  return [];
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function copy(text?: string | null) {
  if (!text) return;
  navigator.clipboard.writeText(text);
  toast.success("已复制");
}

function useViewportWidth() {
  const [width, setWidth] = useState(() => (typeof window === "undefined" ? 1440 : window.innerWidth));
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return width;
}

function useCompactLayout(breakpoint = 980) {
  return useViewportWidth() < breakpoint;
}

function buildSegments(shots: Shot[]): VideoSegment[] {
  const byEpisode = new Map<number, Shot[]>();
  for (const shot of shots) {
    const list = byEpisode.get(shot.episodeNumber) ?? [];
    list.push(shot);
    byEpisode.set(shot.episodeNumber, list);
  }

  const segments: VideoSegment[] = [];
  for (const [episodeNumber, episodeShots] of Array.from(byEpisode.entries()).sort(([a], [b]) => a - b)) {
    const sorted = [...episodeShots].sort((a, b) => a.shotNumber - b.shotNumber);
    let group: Shot[] = [];
    let duration = 0;
    let segmentNumber = 1;
    const flush = () => {
      if (!group.length) return;
      segments.push({
        id: `${episodeNumber}-${segmentNumber}`,
        episodeNumber,
        segmentNumber,
        duration: Math.max(8, Math.min(15, duration || group.length * 5)),
        shots: group,
      });
      group = [];
      duration = 0;
      segmentNumber++;
    };
    for (const shot of sorted) {
      const shotDuration = shot.videoDuration ?? 5;
      if (group.length >= 3 || (duration + shotDuration > 15 && group.length >= 2)) flush();
      group.push(shot);
      duration += shotDuration;
    }
    flush();
  }
  return segments;
}

function renumberEpisodes(list: SplitEpisode[]) {
  return list.map((episode, index) => ({
    ...episode,
    episodeNumber: index + 1,
    title: episode.title.trim() || `第 ${index + 1} 集`,
  }));
}

export default function PremiumStudio() {
  return (
    <InternalGate>
      <StudioShell />
    </InternalGate>
  );
}

function InternalGate({ children }: { children: ReactNode }) {
  const utils = trpc.useUtils();
  const [password, setPassword] = useState("");
  const me = trpc.auth.me.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const status = trpc.auth.internalStatus.useQuery(undefined, { retry: false });
  const login = trpc.auth.internalLogin.useMutation({
    onSuccess: async () => {
      toast.success("已进入内部工作台");
      await utils.auth.me.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  if (me.isLoading || status.isLoading) return <LoadingScreen />;
  if (me.data) return <>{children}</>;

  return (
    <div style={{ minHeight: "100vh", background: C.app, color: C.text, display: "grid", placeItems: "center", padding: 20 }}>
      <section style={card({ width: "min(420px, 100%)", padding: 24 })}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: C.purpleSoft, color: C.purple, display: "grid", placeItems: "center" }}>
            <KeyRound size={22} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20 }}>鎏光机内部访问</h1>
            <div style={{ ...tinyLabel(), marginTop: 4 }}>输入内部访问密码进入工作台</div>
          </div>
        </div>
        {!status.data?.configured ? (
          <div style={{ ...tinyLabel(C.red), lineHeight: 1.7 }}>服务器还没有配置内部访问密码。</div>
        ) : (
          <form
            style={{ display: "grid", gap: 12 }}
            onSubmit={(event) => {
              event.preventDefault();
              login.mutate({ password });
            }}
          >
            <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="访问密码" style={field()} />
            <Button disabled={!password || login.isPending} style={{ background: C.ink, color: "#fff", fontWeight: 800, borderRadius: 8 }}>
              {login.isPending ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />}
              进入
            </Button>
          </form>
        )}
      </section>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div style={{ minHeight: "100vh", background: C.app, display: "grid", placeItems: "center" }}>
      <Loader2 className="animate-spin" style={{ color: C.purple }} />
    </div>
  );
}

function StudioShell() {
  const compact = useCompactLayout();
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);
  const [module, setModule] = useState<ModuleKey>("overview");
  const [scriptText, setScriptText] = useState("");
  const [episodes, setEpisodes] = useState<SplitEpisode[]>([]);
  const [activeEpisode, setActiveEpisode] = useState(1);
  const [activeSegmentId, setActiveSegmentId] = useState<string | number | null>(null);
  const openShots = useCallback(() => setModule("shots"), []);

  const projectsQuery = trpc.overseas.listProjects.useQuery(undefined, { refetchOnWindowFocus: false });
  const projectQuery = trpc.overseas.getProject.useQuery(
    { id: activeProjectId! },
    { enabled: activeProjectId !== null, refetchOnWindowFocus: false }
  );
  const projects = (projectsQuery.data ?? []) as Project[];
  const project = projectQuery.data?.project as Project | undefined;
  const shots = (projectQuery.data?.shots ?? []) as Shot[];
  const segmentsQuery = trpc.overseas.listVideoSegments.useQuery(
    { projectId: activeProjectId! },
    { enabled: activeProjectId !== null && shots.length > 0, refetchOnWindowFocus: false }
  );
  const formalSegments = (segmentsQuery.data ?? []) as VideoSegment[];
  const videoSegmentCount = formalSegments.length || buildSegments(shots).length;

  useEffect(() => {
    if (!activeProjectId && projects.length > 0) setActiveProjectId(projects[0].id);
  }, [activeProjectId, projects]);

  const subtitle = project
    ? `${project.aspectRatio === "portrait" ? "9:16 竖屏" : "16:9 横屏"} · ${getVisualStylePreset(project.visualStylePreset).name}`
    : "固定资产参考驱动的 Seedance 2.0 精品剧工作台";

  return (
    <div style={{ minHeight: "100vh", background: C.app, color: C.text, display: "grid", gridTemplateColumns: compact ? "1fr" : "280px 1fr", gridTemplateRows: compact ? "auto minmax(0, 1fr)" : undefined }}>
      <Sidebar
        projects={projects}
        activeProjectId={activeProjectId}
        activeModule={module}
        compact={compact}
        onProject={(id) => setActiveProjectId(id)}
        onNew={() => {
          setActiveProjectId(null);
          setModule("definition");
        }}
        onModule={setModule}
      />
      <main style={{ minWidth: 0, display: "grid", gridTemplateRows: compact ? "auto minmax(0, 1fr)" : "64px 1fr" }}>
        <header style={{ background: C.panel, borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: compact ? "12px 14px" : "0 24px", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900 }}>{project?.name ?? "新项目"}</div>
            <div style={{ ...tinyLabel(), marginTop: 3 }}>{subtitle}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={pill(Boolean(project))}>{project ? "已连接项目" : "等待创建"}</span>
            <span style={pill()}>{shots.length} 个分镜</span>
            <span style={pill()}>{videoSegmentCount} 个视频段</span>
          </div>
        </header>
        <section style={{ minHeight: 0, overflow: "hidden" }}>
          {module === "overview" && (
            <OverviewView
              project={project}
              shots={shots}
              videoSegmentCount={videoSegmentCount}
              onModule={setModule}
            />
          )}
          {module === "definition" && (
            <DefinitionView
              project={project}
              scriptText={scriptText}
              onScriptText={setScriptText}
              onCreated={(id) => {
                setActiveProjectId(id);
                setModule("script");
              }}
              onSaved={() => {
                projectQuery.refetch();
                projectsQuery.refetch();
              }}
            />
          )}
          {module === "script" && (
            <ScriptSplitView
              project={project}
              scriptText={scriptText}
              episodes={episodes}
              activeEpisode={activeEpisode}
              onScriptText={setScriptText}
              onEpisodes={setEpisodes}
              onActiveEpisode={setActiveEpisode}
              onChanged={() => projectQuery.refetch()}
              onOpenShots={openShots}
            />
          )}
          {module === "rules" && <DirectorRulesView project={project} scriptText={scriptText} onSaved={() => projectQuery.refetch()} />}
          {module === "assets" && <AssetsView project={project} />}
          {module === "shots" && (
            <ShotWorkbench
              project={project}
              shots={shots}
              activeEpisode={activeEpisode}
              activeSegmentId={activeSegmentId}
              onActiveEpisode={setActiveEpisode}
              onActiveSegment={setActiveSegmentId}
              onChanged={() => projectQuery.refetch()}
            />
          )}
          {module === "records" && <GenerationRecordsView project={project} shots={shots} />}
        </section>
      </main>
    </div>
  );
}

function Sidebar({
  projects,
  activeProjectId,
  activeModule,
  compact,
  onProject,
  onNew,
  onModule,
}: {
  projects: Project[];
  activeProjectId: number | null;
  activeModule: ModuleKey;
  compact: boolean;
  onProject: (id: number) => void;
  onNew: () => void;
  onModule: (module: ModuleKey) => void;
}) {
  return (
    <aside style={{ background: C.side, borderRight: compact ? "none" : `1px solid ${C.line}`, borderBottom: compact ? `1px solid ${C.line}` : "none", padding: compact ? 10 : 16, display: "grid", gridTemplateRows: compact ? "auto auto" : "auto auto 1fr", gap: compact ? 10 : 18, minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, fontWeight: 900 }}>
          <Clapperboard size={22} style={{ color: C.ink }} />
          鎏光机
        </div>
        <Button size="sm" variant="outline" onClick={onNew} style={{ borderColor: C.line, borderRadius: 8 }}>
          <Plus size={14} />
        </Button>
      </div>
      <nav style={{ display: compact ? "flex" : "grid", gap: 6, overflowX: compact ? "auto" : undefined, paddingBottom: compact ? 2 : undefined }}>
        {navItems.map((item) => (
          <button
            key={item.key}
            onClick={() => onModule(item.key)}
            style={{
              height: compact ? 36 : 38,
              border: `1px solid ${activeModule === item.key ? "#d8ccff" : "transparent"}`,
              background: activeModule === item.key ? C.purpleSoft : "transparent",
              color: activeModule === item.key ? C.purple : C.text,
              borderRadius: 8,
              padding: "0 10px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              cursor: "pointer",
              fontWeight: 800,
              fontSize: 13,
              flex: compact ? "0 0 auto" : undefined,
            }}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>
      {!compact && <section style={{ minHeight: 0, overflow: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ ...tinyLabel(C.dim), fontWeight: 800 }}>项目列表</div>
          <span style={tinyLabel(C.dim)}>{projects.length}</span>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => onProject(project.id)}
              style={{
                ...card({
                  padding: 10,
                  textAlign: "left",
                  cursor: "pointer",
                  background: activeProjectId === project.id ? "#fff" : "transparent",
                  borderColor: activeProjectId === project.id ? C.lineStrong : "transparent",
                  boxShadow: activeProjectId === project.id ? "0 4px 16px rgba(20,20,20,0.05)" : "none",
                }),
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{project.name}</div>
              <div style={{ ...tinyLabel(C.dim), marginTop: 5 }}>{project.aspectRatio === "portrait" ? "9:16" : "16:9"} · {getVisualStylePreset(project.visualStylePreset).name}</div>
            </button>
          ))}
          {projects.length === 0 && <div style={{ ...tinyLabel(C.dim), lineHeight: 1.7 }}>还没有项目。点击上方 + 创建第一个精品剧。</div>}
        </div>
      </section>}
    </aside>
  );
}

function OverviewView({
  project,
  shots,
  videoSegmentCount,
  onModule,
}: {
  project?: Project;
  shots: Shot[];
  videoSegmentCount: number;
  onModule: (module: ModuleKey) => void;
}) {
  const compact = useCompactLayout();
  const { data: assetData = [] } = trpc.overseas.listAssets.useQuery(
    { projectId: project?.id ?? 0 },
    { enabled: Boolean(project?.id), refetchOnWindowFocus: false }
  );
  const assets = assetData as Asset[];
  const fixedAssets = assets.filter((asset) => !!assetImage(asset));
  const promptReady = shots.filter((shot) => Boolean(shot.videoPrompt)).length;
  const videoReady = shots.filter((shot) => Boolean(shot.videoUrl)).length;
  const storyboardReady = shots.filter((shot) => Boolean(shot.storyboardSketchUrl)).length;
  const cameraReady = shots.filter((shot) => Boolean(shot.cameraDiagramUrl)).length;
  const episodeCount = new Set(shots.map((shot) => shot.episodeNumber)).size;

  const stages: Array<{
    module: ModuleKey;
    label: string;
    value: string;
    state: "done" | "active" | "idle";
    icon: ReactNode;
  }> = [
    {
      module: "definition",
      label: "项目定义",
      value: project?.definition?.trim() ? "已定稿" : "待填写",
      state: project?.definition?.trim() ? "done" : "active",
      icon: <Film size={17} />,
    },
    {
      module: "script",
      label: "剧本分集",
      value: shots.length ? `${episodeCount} 集 · ${shots.length} 分镜` : "待解析",
      state: shots.length ? "done" : project ? "active" : "idle",
      icon: <FileText size={17} />,
    },
    {
      module: "assets",
      label: "固定资产",
      value: fixedAssets.length ? `${fixedAssets.length} 个参考` : "待添加",
      state: fixedAssets.length ? "done" : shots.length ? "active" : "idle",
      icon: <Boxes size={17} />,
    },
    {
      module: "shots",
      label: "镜头工作台",
      value: videoSegmentCount ? `${videoSegmentCount} 个视频段` : "待分段",
      state: videoSegmentCount ? "done" : shots.length ? "active" : "idle",
      icon: <Clapperboard size={17} />,
    },
    {
      module: "records",
      label: "生成结果",
      value: videoReady ? `${videoReady} 条视频` : promptReady ? `${promptReady} 条提示词` : "待生成",
      state: videoReady ? "done" : promptReady ? "active" : "idle",
      icon: <Archive size={17} />,
    },
  ];
  const nextStage = stages.find((stage) => stage.state !== "done") ?? stages[stages.length - 1];
  const todoItems = [
    !project?.definition?.trim() ? "完善项目定义" : null,
    shots.length === 0 ? "导入剧本并分集" : null,
    fixedAssets.length === 0 && shots.length > 0 ? "添加固定参考资产" : null,
    storyboardReady < shots.length && shots.length > 0 ? "补齐分镜草图" : null,
    cameraReady < shots.length && shots.length > 0 ? "补齐机位示意图" : null,
    promptReady < videoSegmentCount && videoSegmentCount > 0 ? "生成15秒提示词" : null,
    videoReady < videoSegmentCount && promptReady > 0 ? "生成Seedance视频" : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <div style={{ height: compact ? "auto" : "calc(100vh - 64px)", minHeight: compact ? "calc(100vh - 136px)" : undefined, padding: compact ? 14 : 22, display: "grid", gridTemplateRows: "auto 1fr", gap: 16, overflow: compact ? "auto" : "hidden" }}>
      <section style={card({ padding: compact ? 16 : 20, display: "grid", gridTemplateColumns: compact ? "1fr" : "1fr auto", alignItems: "center", gap: 18 })}>
        <div>
          <div style={{ ...tinyLabel(C.gold), fontWeight: 900, marginBottom: 8 }}>AI 影片生产总览</div>
          <h1 style={{ margin: 0, fontSize: 24 }}>{project?.name ?? "创建一个精品剧项目"}</h1>
          <div style={{ ...tinyLabel(), marginTop: 8 }}>
            {project ? `${project.aspectRatio === "portrait" ? "9:16" : "16:9"} · ${getVisualStylePreset(project.visualStylePreset).name}` : "固定资产参考 + 分镜视频段 + Seedance 2.0 多参生成"}
          </div>
        </div>
        <Button onClick={() => onModule(nextStage.module)} style={{ background: C.ink, color: "#fff", borderRadius: 8, minWidth: 132 }}>
          <ChevronRight size={15} />
          {nextStage.state === "done" ? "查看结果" : `进入${nextStage.label}`}
        </Button>
      </section>

      <section style={{ minHeight: 0, display: "grid", gridTemplateColumns: compact ? "1fr" : "minmax(0, 1fr) 340px", gap: 16, overflow: compact ? "visible" : "hidden" }}>
        <div style={card({ padding: 18, minHeight: 0, overflow: "auto" })}>
          <div style={{ display: "grid", gridTemplateColumns: compact ? "repeat(auto-fit, minmax(150px, 1fr))" : "repeat(5, minmax(130px, 1fr))", gap: 10 }}>
            {stages.map((stage, index) => (
              <button
                key={stage.module}
                onClick={() => onModule(stage.module)}
                style={{
                  ...card({
                    minHeight: 128,
                    padding: 14,
                    textAlign: "left",
                    cursor: "pointer",
                    borderColor: stage.state === "done" ? "#cfe8dc" : stage.state === "active" ? "#d8ccff" : C.line,
                    background: stage.state === "done" ? "#f0faf5" : stage.state === "active" ? C.purpleSoft : C.panel,
                  }),
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ ...pill(stage.state === "active"), padding: 7 }}>{stage.icon}</span>
                  <span style={tinyLabel(stage.state === "done" ? C.green : stage.state === "active" ? C.purple : C.dim)}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 900, marginTop: 14 }}>{stage.label}</div>
                <div style={{ ...tinyLabel(), marginTop: 6 }}>{stage.value}</div>
              </button>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: compact ? "repeat(2, minmax(0, 1fr))" : "repeat(4, 1fr)", gap: 10, marginTop: 16 }}>
            <Metric label="分镜草图" value={`${storyboardReady}/${shots.length || 0}`} />
            <Metric label="机位示意" value={`${cameraReady}/${shots.length || 0}`} />
            <Metric label="15秒提示词" value={`${promptReady}/${videoSegmentCount || 0}`} />
            <Metric label="Seedance视频" value={`${videoReady}/${videoSegmentCount || 0}`} />
          </div>

          <div style={card({ padding: 16, marginTop: 16, background: C.panelSoft })}>
            <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 8 }}>待办队列</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {(todoItems.length ? todoItems : ["项目已进入出片检查"]).map((item, index) => (
                <span key={item} style={pill(index === 0)}>{item}</span>
              ))}
            </div>
          </div>
        </div>

        <aside style={card({ padding: 16, minHeight: 0, display: "grid", gridTemplateRows: "auto auto 1fr", gap: 12 })}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900 }}>当前焦点</div>
            <div style={{ ...tinyLabel(), marginTop: 5 }}>{nextStage.label} · {nextStage.value}</div>
          </div>
          <Button onClick={() => onModule(nextStage.module)} style={{ background: C.ink, color: "#fff", borderRadius: 8 }}>
            <ChevronRight size={14} />
            继续制作
          </Button>
          <div style={{ minHeight: 0, overflow: "auto", display: "grid", gap: 9, alignContent: "start" }}>
            {fixedAssets.slice(0, 8).map((asset) => (
              <button key={asset.id} onClick={() => onModule("assets")} style={{ ...card({ padding: 8, display: "grid", gridTemplateColumns: "42px 1fr", gap: 10, textAlign: "left", cursor: "pointer" }) }}>
                <div style={{ width: 42, height: 42, borderRadius: 7, background: C.panelSoft, overflow: "hidden" }}>
                  <img src={assetImage(asset)!} alt={asset.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{asset.name}</div>
                  <div style={{ ...tinyLabel(C.purple), marginTop: 4 }}>{assetTag(asset)}</div>
                </div>
              </button>
            ))}
            {fixedAssets.length === 0 && <Empty title={project ? "资产库还没有可引用图片。" : "请先创建项目。"} icon={<Boxes size={34} />} />}
          </div>
        </aside>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={card({ padding: 14 })}>
      <div style={tinyLabel()}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 950, marginTop: 6 }}>{value}</div>
    </div>
  );
}

function DefinitionView({
  project,
  scriptText,
  onScriptText,
  onCreated,
  onSaved,
}: {
  project?: Project;
  scriptText: string;
  onScriptText: (text: string) => void;
  onCreated: (id: number) => void;
  onSaved: () => void;
}) {
  const compact = useCompactLayout();
  const [name, setName] = useState(project?.name ?? "");
  const [definition, setDefinition] = useState(project?.definition ?? "");
  const [aspectRatio, setAspectRatio] = useState<Project["aspectRatio"]>(project?.aspectRatio ?? "portrait");
  const [presetId, setPresetId] = useState(project?.visualStylePreset ?? "natural_practical_light");
  const [enhancerIds, setEnhancerIds] = useState<string[]>(parseStyleEnhancers(project?.styleEnhancers));

  useEffect(() => {
    setName(project?.name ?? "");
    setDefinition(project?.definition ?? "");
    setAspectRatio(project?.aspectRatio ?? "portrait");
    setPresetId(project?.visualStylePreset ?? "natural_practical_light");
    setEnhancerIds(parseStyleEnhancers(project?.styleEnhancers));
  }, [project?.id]);

  const utils = trpc.useUtils();
  const preset = getVisualStylePreset(presetId);
  const enhancerState = validateStyleEnhancers(enhancerIds);
  const visualStylePrompt = buildVisualStylePrompt(preset, enhancerState.selectedIds);
  const createProject = trpc.overseas.createProject.useMutation({
    onSuccess: async (created) => {
      toast.success("项目已创建");
      await utils.overseas.listProjects.invalidate();
      onCreated(created.id);
    },
    onError: (err) => toast.error(err.message),
  });
  const updateProject = trpc.overseas.updateProject.useMutation({
    onSuccess: async () => {
      toast.success("项目定义已保存");
      await utils.overseas.listProjects.invalidate();
      onSaved();
    },
    onError: (err) => toast.error(err.message),
  });

  const save = () => {
    if (!name.trim()) {
      toast.error("请先填写项目名称");
      return;
    }
    const payload = {
      name: name.trim(),
      definition,
      market: "cn",
      aspectRatio,
      style: "realistic" as const,
      genre: preset.id,
      visualStylePreset: preset.id,
      styleEnhancers: JSON.stringify(enhancerState.selectedIds),
      visualStylePrompt,
      projectType: "premium" as const,
    };
    if (project) updateProject.mutate({ id: project.id, ...payload });
    else createProject.mutate({
      ...payload,
      projectBible: defaultDirectorRules({ name: name.trim(), visualStylePreset: preset.id }),
    });
  };

  return (
    <div style={{ height: compact ? "auto" : "calc(100vh - 64px)", minHeight: compact ? "calc(100vh - 136px)" : undefined, padding: compact ? 14 : 22, display: "grid", gridTemplateColumns: compact ? "1fr" : "minmax(520px, 1fr) 320px", gap: 18, overflow: compact ? "auto" : "hidden" }}>
      <section style={card({ padding: 18, display: "grid", gridTemplateRows: "auto auto 1fr auto", gap: 14, minHeight: 0 })}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20 }}>项目定义</h1>
          <div style={{ ...tinyLabel(), marginTop: 6 }}>只保留项目名、画幅、剧本和摄影风格，不再让用户填写集数和时长。</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr" : "1fr 170px 220px", gap: 10 }}>
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="项目名称" style={field()} />
          <Select value={aspectRatio} onValueChange={(value) => setAspectRatio(value as Project["aspectRatio"])}>
            <SelectTrigger style={field()}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="portrait">9:16 竖屏</SelectItem>
              <SelectItem value="landscape">16:9 横屏</SelectItem>
            </SelectContent>
          </Select>
          <Select value={presetId} onValueChange={setPresetId}>
            <SelectTrigger style={field()}><SelectValue /></SelectTrigger>
            <SelectContent>
              {VISUAL_STYLE_PRESETS.map((presetItem) => <SelectItem key={presetItem.id} value={presetItem.id}>{presetItem.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div style={{ display: "grid", gridTemplateRows: compact ? "120px minmax(260px, 1fr)" : "120px 1fr", gap: 10, minHeight: 0 }}>
          <Textarea value={definition} onChange={(event) => setDefinition(event.target.value)} placeholder="项目一句话设定、核心人物关系、必须保留或禁止的内容" style={{ ...field(), resize: "none", lineHeight: 1.7 }} />
          <Textarea value={scriptText} onChange={(event) => onScriptText(event.target.value)} placeholder="粘贴完整剧本，或者先创建项目后到“剧本分集”页继续粘贴。" style={{ ...field(), resize: "none", minHeight: 0, lineHeight: 1.75 }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {STYLE_ENHANCERS.slice(0, 8).map((tag) => {
              const selected = enhancerIds.includes(tag.id);
              return (
                <button key={tag.id} type="button" onClick={() => setEnhancerIds((prev) => selected ? prev.filter((id) => id !== tag.id) : [...prev, tag.id].slice(0, 5))} style={pill(selected)}>
                  {tag.label}
                </button>
              );
            })}
          </div>
          <Button onClick={save} disabled={createProject.isPending || updateProject.isPending} style={{ background: C.ink, color: "#fff", borderRadius: 8, minWidth: 140 }}>
            {createProject.isPending || updateProject.isPending ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />}
            {project ? "保存项目" : "创建项目，进入分集"}
          </Button>
        </div>
      </section>
      <aside style={{ display: "grid", gridTemplateRows: "auto auto 1fr", gap: 12, minHeight: 0 }}>
        <section style={card({ padding: 16 })}>
          <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 12 }}>项目准备状态</div>
          {[
            ["剧本", scriptText.trim() ? "已导入" : "未导入"],
            ["导演规则", project?.projectBible ? "已生成" : "未生成"],
            ["资产库", "待整理"],
            ["视频段", "待拆解"],
          ].map(([label, value]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: `1px solid ${C.line}` }}>
              <span style={tinyLabel()}>{label}</span>
              <strong style={{ fontSize: 12 }}>{value}</strong>
            </div>
          ))}
        </section>
        <section style={card({ padding: 16 })}>
          <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 8 }}>视觉风格摘要</div>
          <div style={{ ...tinyLabel(), whiteSpace: "pre-wrap", maxHeight: 210, overflow: "auto" }}>{visualStylePrompt}</div>
        </section>
        <section style={card({ padding: 16, minHeight: 0, overflow: "auto" })}>
          <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 8 }}>下一步</div>
          <div style={{ ...tinyLabel(), lineHeight: 1.7 }}>创建项目后进入“剧本分集”，由 AI 自动识别集数，再拆成分镜镜头。后续多个分镜会合成 15 秒左右的视频段。</div>
        </section>
      </aside>
    </div>
  );
}

function ScriptSplitView({
  project,
  scriptText,
  episodes,
  activeEpisode,
  onScriptText,
  onEpisodes,
  onActiveEpisode,
  onChanged,
  onOpenShots,
}: {
  project?: Project;
  scriptText: string;
  episodes: SplitEpisode[];
  activeEpisode: number;
  onScriptText: (text: string) => void;
  onEpisodes: (episodes: SplitEpisode[]) => void;
  onActiveEpisode: (episode: number) => void;
  onChanged: () => void;
  onOpenShots: () => void;
}) {
  const compact = useCompactLayout();
  const utils = trpc.useUtils();
  const [jobId, setJobId] = useState<number | null>(null);
  const [quickStartPending, setQuickStartPending] = useState(false);
  const selectedEpisode = episodes.find((episode) => episode.episodeNumber === activeEpisode) ?? episodes[0];
  const splitScript = trpc.overseas.splitScriptIntoEpisodes.useMutation({
    onSuccess: (data) => {
      onEpisodes(data.episodes);
      onActiveEpisode(data.episodes[0]?.episodeNumber ?? 1);
      toast.success(`已识别 ${data.episodes.length} 集`);
    },
    onError: (err) => toast.error(err.message),
  });
  const batchParse = trpc.overseas.batchParseScripts.useMutation({
    onSuccess: (data) => {
      setJobId(data.jobId);
      toast.info("分镜设计生成中");
    },
    onError: (err) => toast.error(err.message),
  });
  const analyzeAssets = trpc.overseas.analyzeScriptFull.useMutation({
    onSuccess: (data: any) => toast.success(`资产识别完成：新增 ${data.addedCount ?? 0} 个`),
    onError: (err) => toast.error(err.message),
  });
  const { data: job } = trpc.overseas.getBatchJob.useQuery(
    { jobId: jobId! },
    { enabled: jobId !== null, refetchInterval: jobId ? 2500 : false }
  );

  useEffect(() => {
    if (!project || !job || job.status !== "done") return;
    void (async () => {
      toast.success(`分镜设计完成：${job.succeeded}/${job.total}`);
      setJobId(null);
      await utils.overseas.getProject.invalidate({ id: project.id });
      await utils.overseas.listShots.invalidate();
      onChanged();
      onOpenShots();
    })();
  }, [job, onChanged, onOpenShots, project, utils]);

  const startStoryboard = () => {
    if (!project) {
      toast.error("请先创建项目");
      return;
    }
    const sourceEpisodes = episodes.length > 0
      ? episodes
      : [{ episodeNumber: activeEpisode, title: `第 ${activeEpisode} 集`, scriptText }];
    if (sourceEpisodes.some((episode) => episode.scriptText.trim().length < 10)) {
      toast.error("剧本文本不足");
      return;
    }
    batchParse.mutate({
      projectId: project.id,
      scripts: sourceEpisodes.map((episode) => ({ episodeNumber: episode.episodeNumber, scriptText: episode.scriptText })),
      language: "zh",
    });
    analyzeAssets.mutate({
      projectId: project.id,
      scriptText: sourceEpisodes.map((episode) => `第${episode.episodeNumber}集\n${episode.scriptText}`).join("\n\n"),
    });
  };

  const quickStart = async () => {
    if (!project) return toast.error("请先创建项目");
    if (scriptText.trim().length < 10 && episodes.length === 0) return toast.error("请先粘贴剧本");
    setQuickStartPending(true);
    try {
      const sourceEpisodes = episodes.length > 0
        ? episodes
        : (await splitScript.mutateAsync({ projectId: project.id, scriptText })).episodes;
      onEpisodes(sourceEpisodes);
      onActiveEpisode(sourceEpisodes[0]?.episodeNumber ?? 1);
      const scripts = sourceEpisodes.map((episode) => ({ episodeNumber: episode.episodeNumber, scriptText: episode.scriptText }));
      const data = await batchParse.mutateAsync({ projectId: project.id, scripts, language: "zh" });
      setJobId(data.jobId);
      analyzeAssets.mutate({
        projectId: project.id,
        scriptText: sourceEpisodes.map((episode) => `第${episode.episodeNumber}集\n${episode.scriptText}`).join("\n\n"),
      });
      toast.info("已开始：分集、资产识别、分镜设计");
    } catch (err: any) {
      toast.error(err.message || "一键制作启动失败");
    } finally {
      setQuickStartPending(false);
    }
  };
  const selectedIndex = selectedEpisode ? episodes.findIndex((episode) => episode.episodeNumber === selectedEpisode.episodeNumber) : -1;
  const updateSelectedEpisode = (patch: Partial<Pick<SplitEpisode, "title" | "scriptText">>) => {
    if (!selectedEpisode) return;
    onEpisodes(episodes.map((episode) => (
      episode.episodeNumber === selectedEpisode.episodeNumber ? { ...episode, ...patch } : episode
    )));
  };
  const mergeNextEpisode = () => {
    if (selectedIndex < 0 || selectedIndex >= episodes.length - 1) return toast.info("当前集后面没有可合并内容");
    const current = episodes[selectedIndex];
    const next = episodes[selectedIndex + 1];
    const merged = [
      ...episodes.slice(0, selectedIndex),
      {
        ...current,
        title: `${current.title} / ${next.title}`.slice(0, 80),
        scriptText: `${current.scriptText.trim()}\n\n${next.scriptText.trim()}`.trim(),
      },
      ...episodes.slice(selectedIndex + 2),
    ];
    onEpisodes(renumberEpisodes(merged));
    onActiveEpisode(selectedIndex + 1);
    toast.success("已合并下一集");
  };
  const insertEpisodeAfter = () => {
    const insertAt = selectedIndex >= 0 ? selectedIndex + 1 : episodes.length;
    const next = renumberEpisodes([
      ...episodes.slice(0, insertAt),
      { episodeNumber: insertAt + 1, title: "新分集", scriptText: "" },
      ...episodes.slice(insertAt),
    ]);
    onEpisodes(next);
    onActiveEpisode(insertAt + 1);
    toast.success("已插入新分集");
  };
  const deleteSelectedEpisode = () => {
    if (!selectedEpisode) return;
    if (episodes.length <= 1) {
      onEpisodes([]);
      onActiveEpisode(1);
      toast.success("已清空分集");
      return;
    }
    const next = renumberEpisodes(episodes.filter((episode) => episode.episodeNumber !== selectedEpisode.episodeNumber));
    onEpisodes(next);
    onActiveEpisode(Math.min(selectedEpisode.episodeNumber, next.length));
    toast.success("已删除当前集");
  };

  return (
    <div style={{ height: compact ? "auto" : "calc(100vh - 64px)", minHeight: compact ? "calc(100vh - 136px)" : undefined, padding: compact ? 14 : 22, display: "grid", gridTemplateColumns: compact ? "1fr" : "minmax(380px, 0.9fr) minmax(360px, 0.8fr) 360px", gap: 16, overflow: compact ? "auto" : "hidden" }}>
      <section style={card({ padding: 16, display: "grid", gridTemplateRows: "auto 1fr auto", gap: 12, minHeight: 0 })}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17 }}>原始剧本</h2>
            <div style={tinyLabel()}>AI 自动识别集数，不需要手填集数和时长。</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="outline" disabled={!project || splitScript.isPending || !scriptText.trim()} onClick={() => project && splitScript.mutate({ projectId: project.id, scriptText })} style={{ borderColor: C.line, borderRadius: 8 }}>
              {splitScript.isPending ? <Loader2 className="animate-spin" size={14} /> : <Layers size={14} />}
              智能分集
            </Button>
            <Button disabled={!project || quickStartPending || batchParse.isPending || !!jobId || (!scriptText.trim() && episodes.length === 0)} onClick={quickStart} style={{ background: C.ink, color: "#fff", borderRadius: 8 }}>
              {quickStartPending || batchParse.isPending || jobId ? <Loader2 className="animate-spin" size={14} /> : <Wand2 size={14} />}
              一键分集并生成分镜
            </Button>
          </div>
        </div>
        <Textarea value={scriptText} onChange={(event) => onScriptText(event.target.value)} placeholder="粘贴剧本。已有“第X集 / EP X”标记时会优先按原标记切分。" style={{ ...field(), resize: "none", minHeight: 0, lineHeight: 1.75 }} />
        {jobId && job && <div style={tinyLabel(C.purple)}>{job.currentName} · {job.current}/{job.total}</div>}
      </section>
      <section style={card({ padding: 16, minHeight: 0, overflow: "auto" })}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>AI 分集结果</h2>
          <Button disabled={!project || batchParse.isPending || !!jobId} onClick={startStoryboard} style={{ background: C.ink, color: "#fff", borderRadius: 8 }}>
            {batchParse.isPending || jobId ? <Loader2 className="animate-spin" size={14} /> : <Wand2 size={14} />}
            生成分镜
          </Button>
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {episodes.map((episode) => (
            <button
              key={episode.episodeNumber}
              onClick={() => onActiveEpisode(episode.episodeNumber)}
              style={{
                ...card({
                  padding: 12,
                  cursor: "pointer",
                  textAlign: "left",
                  borderColor: activeEpisode === episode.episodeNumber ? "#d8ccff" : C.line,
                  background: activeEpisode === episode.episodeNumber ? C.purpleSoft : C.panel,
                }),
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <strong style={{ fontSize: 13 }}>第 {episode.episodeNumber} 集 · {episode.title}</strong>
                <span style={tinyLabel(activeEpisode === episode.episodeNumber ? C.purple : C.dim)}>可编辑</span>
              </div>
              <div style={{ ...tinyLabel(), marginTop: 8, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{episode.scriptText}</div>
            </button>
          ))}
          {episodes.length === 0 && <Empty title="智能分集后，结果会显示在这里。" icon={<FileText size={36} />} />}
        </div>
      </section>
      <section style={card({ padding: 16, minHeight: 0, display: "grid", gridTemplateRows: "auto auto 1fr auto", gap: 10 })}>
        <h2 style={{ margin: 0, fontSize: 17 }}>当前集详情</h2>
        <Input
          value={selectedEpisode?.title ?? ""}
          onChange={(event) => updateSelectedEpisode({ title: event.target.value })}
          placeholder="集标题"
          style={field()}
        />
        <Textarea
          value={selectedEpisode?.scriptText ?? ""}
          onChange={(event) => updateSelectedEpisode({ scriptText: event.target.value })}
          placeholder="当前集完整文本，可在生成分镜前调整。"
          style={{ ...field(), resize: "none", lineHeight: 1.65, minHeight: 0 }}
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <Button variant="outline" disabled={!selectedEpisode || selectedIndex >= episodes.length - 1} onClick={mergeNextEpisode} style={{ borderColor: C.line, borderRadius: 8 }}>合并下一集</Button>
          <Button variant="outline" disabled={!project} onClick={insertEpisodeAfter} style={{ borderColor: C.line, borderRadius: 8 }}>插入新集</Button>
          <Button variant="outline" disabled={!selectedEpisode} onClick={() => copy(selectedEpisode?.scriptText)} style={{ borderColor: C.line, borderRadius: 8 }}>复制正文</Button>
          <Button variant="outline" disabled={!selectedEpisode} onClick={deleteSelectedEpisode} style={{ borderColor: C.line, borderRadius: 8, color: C.red }}>删除当前</Button>
        </div>
      </section>
    </div>
  );
}

function defaultDirectorRules(project?: Pick<Project, "name" | "visualStylePreset">) {
  const styleName = project ? getVisualStylePreset(project.visualStylePreset).name : "当前摄影风格";
  return [
    `导演规则：${project?.name ?? "未命名项目"}`,
    "",
    "1. 故事核心",
    "每个视频段只服务一个明确的戏剧动作：推进关系、揭示信息、制造反转或放大情绪。不得新增剧本外设定，不得为了画面炫技改变人物动机。",
    "",
    "2. 表演规则",
    "人物表演要保留潜台词和停顿。台词不是把情绪说满，而是让观众从眼神、呼吸、迟疑、转身、避开目光里读出真实意图。语气要克制，避免舞台腔和解释型表演。",
    "",
    "3. 分镜与视频段",
    "多个分镜可合并为一条约 15 秒 Seedance 2.0 提示词。合并依据是同一场景、同一情绪连续、同一人物行动链。台词、动作、视线、走位和摄影机运动要按剧情节奏智能分配，不固定切成 0-3/3-10/10-15。",
    "",
    "4. 固定资产参考",
    "人物、场景、服装、道具外观以资产库参考图为准。提示词只描述表演、调度、摄影机、光影和动作连续性，不重新发明人物长相或场景结构。",
    "",
    "5. 摄影风格",
    `画面遵循「${styleName}」方向。优先控制光影、空气感、低照度或高反差等摄影质感，不写泛泛的滤镜词，不堆砌无关镜头型号。`,
    "",
    "6. 禁止事项",
    "不要出现字幕、水印、旁白提示、解释性文字、跳戏喜剧表演、夸张网感特效。不要让人物无目的移动，不要让摄影机运动抢走表演重点。",
  ].join("\n");
}

function DirectorRulesView({ project, scriptText, onSaved }: { project?: Project; scriptText: string; onSaved: () => void }) {
  const compact = useCompactLayout();
  const utils = trpc.useUtils();
  const [rules, setRules] = useState(project?.projectBible ?? "");
  useEffect(() => setRules(project?.projectBible ?? ""), [project?.id, project?.projectBible]);

  const bible = trpc.overseas.generateProjectBible.useMutation({
    onSuccess: async (data) => {
      setRules(data.projectBible);
      toast.success("导演规则已生成");
      if (project) await utils.overseas.getProject.invalidate({ id: project.id });
      onSaved();
    },
    onError: (err) => toast.error(err.message),
  });
  const updateProject = trpc.overseas.updateProject.useMutation({
    onSuccess: () => {
      toast.success("导演规则已保存");
      onSaved();
    },
    onError: (err) => toast.error(err.message),
  });

  const generate = () => {
    if (!project) return toast.error("请先创建项目");
    const source = scriptText.trim() || project.definition || "";
    if (source.trim().length < 10) return toast.error("请先在项目定义或剧本分集里提供足够文本");
    bible.mutate({ projectId: project.id, scriptText: source });
  };
  const useDefaultRules = () => {
    const nextRules = defaultDirectorRules(project);
    setRules(nextRules);
    if (project) updateProject.mutate({ id: project.id, projectBible: nextRules });
  };

  const sections = [
    ["故事核心", "主线冲突、人物目标、每集钩子原则"],
    ["人物关系", "人物之间的权力、情感、隐瞒与冲突"],
    ["表演规则", "语气、潜台词、沉默、呼吸和微表情"],
    ["镜头节奏", "分镜密度、视频段合并、时长判断"],
    ["禁止跑偏项", "不要新增剧情、不要脱离固定资产参考"],
  ];

  return (
    <div style={{ height: compact ? "auto" : "calc(100vh - 64px)", minHeight: compact ? "calc(100vh - 136px)" : undefined, padding: compact ? 14 : 22, display: "grid", gridTemplateColumns: compact ? "1fr" : "1fr 340px", gap: 16, overflow: compact ? "auto" : "hidden" }}>
      <section style={card({ padding: 18, minHeight: 0, display: "grid", gridTemplateRows: "auto auto 1fr auto", gap: 14 })}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20 }}>导演规则</h1>
          <div style={{ ...tinyLabel(), marginTop: 6 }}>服务于拆镜头、表演留白、节奏判断和 Seedance 提示词，不负责人物/场景外观一致性。</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: compact ? "repeat(auto-fit, minmax(130px, 1fr))" : "repeat(5, 1fr)", gap: 8 }}>
          {sections.map(([title, desc]) => (
            <div key={title} style={card({ padding: 12, background: C.panelSoft })}>
              <div style={{ fontSize: 13, fontWeight: 900 }}>{title}</div>
              <div style={{ ...tinyLabel(), marginTop: 6 }}>{desc}</div>
            </div>
          ))}
        </div>
        <Textarea value={rules} onChange={(event) => setRules(event.target.value)} placeholder="AI 生成后可编辑。它只影响表演、节奏、分镜和提示词，不锁定人物长相和场景外观。" style={{ ...field(), resize: "none", minHeight: 0, lineHeight: 1.75 }} />
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="outline" disabled={!project || updateProject.isPending} onClick={useDefaultRules} style={{ borderColor: C.line, borderRadius: 8 }}>
              <Check size={14} />
              使用默认规则
            </Button>
            <Button variant="outline" disabled={bible.isPending || !project} onClick={generate} style={{ borderColor: C.line, borderRadius: 8 }}>
            {bible.isPending ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
            AI 生成导演规则
            </Button>
          </div>
          <Button disabled={!project || updateProject.isPending} onClick={() => project && updateProject.mutate({ id: project.id, projectBible: rules })} style={{ background: C.ink, color: "#fff", borderRadius: 8 }}>
            {updateProject.isPending ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
            保存规则
          </Button>
        </div>
      </section>
      <aside style={card({ padding: 16, alignSelf: "start" })}>
        <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 12 }}>规则使用范围</div>
        {["智能分镜", "视频段合并", "15秒提示词", "表演潜台词", "镜头节奏"].map((item) => (
          <div key={item} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderTop: `1px solid ${C.line}` }}>
            <Check size={14} style={{ color: C.green }} />
            <span style={tinyLabel(C.text)}>{item}</span>
          </div>
        ))}
      </aside>
    </div>
  );
}

function AssetsView({ project }: { project?: Project }) {
  const compact = useCompactLayout();
  const utils = trpc.useUtils();
  const [category, setCategory] = useState<AssetType | "all">("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<{ type: AssetType; name: string; description: string; file: File | null }>({
    type: "custom",
    name: "",
    description: "",
    file: null,
  });
  const { data = [] } = trpc.overseas.listAssets.useQuery(
    { projectId: project?.id ?? 0 },
    { enabled: Boolean(project?.id) }
  );
  const assets = (data as Asset[]).filter((asset) => {
    if (category !== "all" && asset.type !== category) return false;
    const keyword = query.trim().toLowerCase();
    if (!keyword) return true;
    return `${asset.name} ${asset.description ?? ""} ${asset.tags ?? ""}`.toLowerCase().includes(keyword);
  });
  const selected = assets.find((asset) => asset.id === selectedId) ?? assets[0];
  const createAsset = trpc.overseas.createAsset.useMutation();
  const uploadAsset = trpc.overseas.uploadAssetToS3.useMutation();
  const deleteAsset = trpc.overseas.deleteAsset.useMutation({
    onSuccess: () => {
      toast.success("资产已删除");
      if (project) utils.overseas.listAssets.invalidate({ projectId: project.id });
    },
    onError: (err) => toast.error(err.message),
  });

  const submit = async () => {
    if (!project) return toast.error("请先创建项目");
    if (!form.name.trim()) return toast.error("请填写资产名称");
    try {
      const asset = await createAsset.mutateAsync({
        projectId: project.id,
        type: form.type,
        name: form.name.trim(),
        description: form.description,
        tags: assetTag({ ...form, id: 0, projectId: project.id } as unknown as Asset),
      });
      if (form.file) {
        const fileBase64 = await fileToBase64(form.file);
        await uploadAsset.mutateAsync({
          assetId: asset.id,
          field: "referenceImageUrl",
          fileBase64,
          contentType: form.file.type || "image/png",
          fileName: form.file.name,
        });
      }
      toast.success("资产已添加");
      setForm({ type: "custom", name: "", description: "", file: null });
      setSelectedId(asset.id);
      await utils.overseas.listAssets.invalidate({ projectId: project.id });
    } catch (err: any) {
      toast.error(err.message || "添加失败");
    }
  };

  return (
    <div style={{ height: compact ? "auto" : "calc(100vh - 64px)", minHeight: compact ? "calc(100vh - 136px)" : undefined, padding: compact ? 14 : 22, display: "grid", gridTemplateColumns: compact ? "1fr" : "190px 1fr 360px", gap: 16, overflow: compact ? "auto" : "hidden" }}>
      <aside style={card({ padding: 12, display: "grid", gridTemplateRows: "auto 1fr auto", gap: 12, minHeight: 0 })}>
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索资产" style={field()} />
        <div style={{ display: "grid", gap: 6, alignContent: "start" }}>
          {(["all", "character", "scene", "costume", "prop", "storyboard", "camera_diagram", "custom"] as Array<AssetType | "all">).map((type) => (
            <button key={type} onClick={() => setCategory(type)} style={{
              height: 34,
              border: "none",
              borderRadius: 8,
              background: category === type ? C.purpleSoft : "transparent",
              color: category === type ? C.purple : C.text,
              textAlign: "left",
              padding: "0 10px",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 800,
            }}>
              {assetLabel[type]}
            </button>
          ))}
        </div>
        <div style={{ ...tinyLabel(), lineHeight: 1.6 }}>资产库是一级模块，镜头工作台只引用这里的固定资产。</div>
      </aside>
      <section style={card({ padding: 16, display: "grid", gridTemplateRows: "auto 1fr", gap: 14, minHeight: 0 })}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20 }}>资产库</h1>
            <div style={tinyLabel()}>人物、场景、服装、道具、分镜草图和机位图都在这里统一管理。</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="outline" style={{ borderColor: C.line, borderRadius: 8 }}><Search size={14} /> 批量管理</Button>
            <Button disabled={!project || createAsset.isPending || uploadAsset.isPending} onClick={submit} style={{ background: C.ink, color: "#fff", borderRadius: 8 }}>
              {createAsset.isPending || uploadAsset.isPending ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
              添加资产
            </Button>
          </div>
        </div>
        <div style={{ minHeight: 0, overflow: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 12 }}>
            {assets.map((asset) => {
              const img = assetImage(asset);
              return (
                <button key={asset.id} onClick={() => setSelectedId(asset.id)} style={{
                  ...card({ padding: 0, overflow: "hidden", cursor: "pointer", textAlign: "left", borderColor: selected?.id === asset.id ? "#d8ccff" : C.line }),
                }}>
                  <div style={{ height: 118, background: C.panelSoft, display: "grid", placeItems: "center", overflow: "hidden" }}>
                    {img ? <img src={img} alt={asset.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <ImageIcon size={28} style={{ color: C.dim }} />}
                  </div>
                  <div style={{ padding: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{asset.name}</div>
                    <div style={{ ...tinyLabel(C.purple), marginTop: 5 }}>{assetTag(asset)}</div>
                    <div style={{ ...tinyLabel(C.dim), marginTop: 4 }}>{assetLabel[asset.type]} {asset.isGlobalRef ? "· 固定参考" : ""}</div>
                  </div>
                </button>
              );
            })}
          </div>
          {assets.length === 0 && <Empty title="还没有资产。添加人物、场景或上传参考图。" icon={<Boxes size={36} />} />}
        </div>
      </section>
      <aside style={card({ padding: 16, minHeight: 0, display: "grid", gridTemplateRows: "auto auto 1fr auto", gap: 12 })}>
        <div style={{ fontSize: 16, fontWeight: 900 }}>资产详情</div>
        <div style={{ display: "grid", gap: 9 }}>
          <Select value={form.type} onValueChange={(value) => setForm((prev) => ({ ...prev, type: value as AssetType }))}>
            <SelectTrigger style={field()}><SelectValue /></SelectTrigger>
            <SelectContent>
              {(["character", "scene", "costume", "prop", "storyboard", "camera_diagram", "custom"] as AssetType[]).map((type) => <SelectItem key={type} value={type}>{assetLabel[type]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="新资产名称" style={field()} />
          <Textarea value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="说明、连续性要求、可见细节" rows={3} style={{ ...field(), resize: "none" }} />
          <label style={{ ...card({ padding: 10, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: C.sub }) }}>
            <Upload size={15} />
            <span style={tinyLabel()}>{form.file ? form.file.name : "上传参考图"}</span>
            <input hidden type="file" accept="image/*" onChange={(event) => setForm((prev) => ({ ...prev, file: event.target.files?.[0] ?? null }))} />
          </label>
        </div>
        <div style={{ minHeight: 0, overflow: "auto", borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
          {selected ? (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ height: 170, background: C.panelSoft, borderRadius: 8, overflow: "hidden", display: "grid", placeItems: "center" }}>
                {assetImage(selected) ? <img src={assetImage(selected)!} alt={selected.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <ImageIcon size={30} style={{ color: C.dim }} />}
              </div>
              <div style={{ fontWeight: 900 }}>{selected.name}</div>
              <div style={pill(true)}><AtSign size={13} /> {assetTag(selected)}</div>
              <div style={{ ...tinyLabel(), lineHeight: 1.65 }}>{selected.description || "暂无说明"}</div>
              {(selected.mjPrompt || selected.stylePrompt) && <div style={{ ...tinyLabel(), whiteSpace: "pre-wrap", background: C.panelSoft, borderRadius: 8, padding: 10 }}>{selected.mjPrompt || selected.stylePrompt}</div>}
            </div>
          ) : <Empty title="选择一个资产查看详情。" icon={<Database size={34} />} />}
        </div>
        <Button variant="outline" disabled={!selected || deleteAsset.isPending} onClick={() => selected && deleteAsset.mutate({ id: selected.id })} style={{ borderColor: C.line, borderRadius: 8, color: C.red }}>
          <Trash2 size={14} /> 删除资产
        </Button>
      </aside>
    </div>
  );
}

function ShotWorkbench({
  project,
  shots,
  activeEpisode,
  activeSegmentId,
  onActiveEpisode,
  onActiveSegment,
  onChanged,
}: {
  project?: Project;
  shots: Shot[];
  activeEpisode: number;
  activeSegmentId: string | number | null;
  onActiveEpisode: (episode: number) => void;
  onActiveSegment: (id: string | number) => void;
  onChanged: () => void;
}) {
  const compact = useCompactLayout(1180);
  const utils = trpc.useUtils();
  const fallbackSegments = useMemo(() => buildSegments(shots), [shots]);
  const { data: segmentData = [] } = trpc.overseas.listVideoSegments.useQuery(
    { projectId: project?.id ?? 0 },
    { enabled: Boolean(project?.id && shots.length > 0), refetchOnWindowFocus: false }
  );
  const segments = useMemo(() => {
    const formalSegments = (segmentData as VideoSegment[]).map((segment) => {
      const segmentShotIds = segment.shotIds ?? segment.shots?.map((shot) => shot.id) ?? [];
      const resolvedShots = segment.shots?.length
        ? segment.shots
        : segmentShotIds.map((id) => shots.find((shot) => shot.id === id)).filter((shot): shot is Shot => Boolean(shot));
      return { ...segment, shots: resolvedShots };
    }).filter((segment) => segment.shots.length > 0);
    return formalSegments.length > 0 ? formalSegments : fallbackSegments;
  }, [fallbackSegments, segmentData, shots]);
  const episodeNumbers = Array.from(new Set(shots.map((shot) => shot.episodeNumber))).sort((a, b) => a - b);
  const currentSegment = segments.find((segment) => segment.id === activeSegmentId) ?? segments.find((segment) => segment.episodeNumber === activeEpisode) ?? segments[0];
  const [activeShotId, setActiveShotId] = useState<number | null>(null);
  const activeShot = currentSegment?.shots.find((shot) => shot.id === activeShotId) ?? currentSegment?.shots[0];
  const segmentLead = currentSegment?.shots[0];
  const [selectedAssetIds, setSelectedAssetIds] = useState<number[]>([]);
  const [segmentPrompt, setSegmentPrompt] = useState("");
  const [duration, setDuration] = useState(15);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);

  const { data: assetData = [] } = trpc.overseas.listAssets.useQuery(
    { projectId: project?.id ?? 0 },
    { enabled: Boolean(project?.id) }
  );
  const assets = assetData as Asset[];
  const imageAssets = assets.filter((asset) => !!assetImage(asset));
  const selectedAssets = imageAssets.filter((asset) => selectedAssetIds.includes(asset.id));
  const referenceUrls = selectedAssets.map((asset) => assetImage(asset)!).slice(0, 9);
  const toggleAsset = (assetId: number) => {
    setSelectedAssetIds((prev) => prev.includes(assetId) ? prev.filter((id) => id !== assetId) : [...prev, assetId].slice(0, 9));
  };

  useEffect(() => {
    if (currentSegment) {
      onActiveEpisode(currentSegment.episodeNumber);
      setActiveShotId(currentSegment.shots[0]?.id ?? null);
      setDuration(currentSegment.duration);
      setSegmentPrompt(currentSegment.prompt ?? currentSegment.shots[0]?.videoPrompt ?? "");
      setSelectedAssetIds(currentSegment.referenceAssetIds ?? []);
    }
  }, [currentSegment?.id]);

  const generateStoryboard = trpc.overseas.generateStoryboardSketch.useMutation({
    onSuccess: async () => {
      toast.success("分镜草图已生成");
      if (project) await utils.overseas.getProject.invalidate({ id: project.id });
      onChanged();
    },
    onError: (err) => toast.error(err.message),
  });
  const generateDiagram = trpc.overseas.generateCameraDiagram.useMutation({
    onSuccess: async () => {
      toast.success("机位图已生成");
      if (project) await utils.overseas.getProject.invalidate({ id: project.id });
      onChanged();
    },
    onError: (err) => toast.error(err.message),
  });
  const addVisual = trpc.overseas.addShotVisualToAssetLibrary.useMutation({
    onSuccess: async () => {
      toast.success("已加入资产库");
      if (project) await utils.overseas.listAssets.invalidate({ projectId: project.id });
    },
    onError: (err) => toast.error(err.message),
  });
  const generateSegmentPrompt = trpc.overseas.generateVideoSegmentPrompt.useMutation({
    onSuccess: async (data) => {
      setSegmentPrompt(data.prompt);
      toast.success("15 秒视频段提示词已生成");
      if (project) await utils.overseas.getProject.invalidate({ id: project.id });
      if (project) await utils.overseas.listVideoSegments.invalidate({ projectId: project.id });
      onChanged();
    },
    onError: (err) => toast.error(err.message),
  });
  const generateVideoSegment = trpc.overseas.generateVideoSegment.useMutation({
    onSuccess: async () => {
      toast.success("Seedance 2.0 视频已生成");
      if (project) await utils.overseas.getProject.invalidate({ id: project.id });
      if (project) await utils.overseas.listVideoSegments.invalidate({ projectId: project.id });
      onChanged();
    },
    onError: (err) => toast.error(err.message),
  });
  const generateVideo = trpc.overseas.generatePremiumVideo.useMutation({
    onSuccess: async () => {
      toast.success("Seedance 2.0 视频已生成");
      if (project) await utils.overseas.getProject.invalidate({ id: project.id });
      onChanged();
    },
    onError: (err) => toast.error(err.message),
  });

  const previewImage = activeShot?.cameraDiagramUrl || activeShot?.storyboardSketchUrl;
  const referenceTags = selectedAssets.map(assetTag);
  if (activeShot?.storyboardSketchUrl) referenceTags.push(`@分镜EP${activeShot.episodeNumber}-${activeShot.shotNumber}`);
  if (activeShot?.cameraDiagramUrl) referenceTags.push(`@机位EP${activeShot.episodeNumber}-${activeShot.shotNumber}`);
  const segmentStats = currentSegment ? getSegmentStats(currentSegment, selectedAssets.length, segmentPrompt) : null;
  const focusShot =
    currentSegment?.shots.find((shot) => !shot.storyboardSketchUrl) ||
    currentSegment?.shots.find((shot) => !shot.cameraDiagramUrl) ||
    activeShot;
  const currentError = currentSegment?.errorMessage || activeShot?.errorMessage || null;
  const runNextSegmentAction = () => {
    if (!currentSegment || !activeShot || !project) return;
    if (segmentStats?.nextAction === "storyboard" && focusShot) {
      setActiveShotId(focusShot.id);
      generateStoryboard.mutate({ shotId: focusShot.id, imageEngine: "image2", addToAssetLibrary: false });
      return;
    }
    if (segmentStats?.nextAction === "camera" && focusShot) {
      setActiveShotId(focusShot.id);
      generateDiagram.mutate({ shotId: focusShot.id, imageEngine: "image2", addToAssetLibrary: false });
      return;
    }
    if (segmentStats?.nextAction === "asset") {
      setAssetPickerOpen(true);
      return;
    }
    if (segmentStats?.nextAction === "prompt") {
      generateSegmentPrompt.mutate({
        projectId: project.id,
        segmentId: typeof currentSegment.id === "number" ? currentSegment.id : undefined,
        shotIds: currentSegment.shots.map((shot) => shot.id),
        referenceAssetIds: selectedAssetIds,
        duration,
      });
      return;
    }
    if (segmentStats?.nextAction === "video" && segmentLead) {
      const aspectRatio = project.aspectRatio === "landscape" ? "16:9" : "9:16";
      if (typeof currentSegment.id === "number") {
        generateVideoSegment.mutate({
          segmentId: currentSegment.id,
          prompt: segmentPrompt,
          referenceImageUrls: referenceUrls,
          duration,
          aspectRatio,
        });
      } else {
        generateVideo.mutate({
          shotId: segmentLead.id,
          prompt: segmentPrompt,
          referenceImageUrls: referenceUrls,
          duration,
          aspectRatio,
        });
      }
    }
  };

  return (
    <div style={{ height: compact ? "auto" : "calc(100vh - 64px)", minHeight: compact ? "calc(100vh - 136px)" : undefined, padding: compact ? 14 : 18, display: "grid", gridTemplateColumns: compact ? "1fr" : "250px minmax(520px, 1fr) 330px", gap: 14, overflow: compact ? "auto" : "hidden" }}>
      <aside style={card({ padding: 12, minHeight: 0, overflow: "auto" })}>
        <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 10 }}>集数 / 视频段</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {episodeNumbers.map((episode) => (
            <button key={episode} onClick={() => onActiveEpisode(episode)} style={pill(activeEpisode === episode)}>第{episode}集</button>
          ))}
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {segments.map((segment) => (
            <div key={segment.id}>
              <button onClick={() => onActiveSegment(segment.id)} style={{
                ...card({
                  width: "100%",
                  padding: 10,
                  cursor: "pointer",
                  textAlign: "left",
                  borderColor: currentSegment?.id === segment.id ? "#d8ccff" : C.line,
                  background: currentSegment?.id === segment.id ? C.purpleSoft : C.panel,
                }),
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <strong style={{ fontSize: 13 }}>{segment.title || `视频段 ${String(segment.segmentNumber).padStart(2, "0")}`}</strong>
                  <span style={tinyLabel(C.purple)}>{segment.duration}s</span>
                </div>
                <div style={{ ...tinyLabel(), marginTop: 5 }}>
                  包含 {segment.shots.length} 个分镜{segment.status ? ` · ${segment.status === "done" ? "已出片" : segment.status === "prompt_ready" ? "提示词已就绪" : segment.status === "generating_video" ? "生成中" : segment.status === "failed" ? "失败" : "草稿"}` : ""}
                </div>
              </button>
              {currentSegment?.id === segment.id && (
                <div style={{ margin: "6px 0 2px 12px", display: "grid", gap: 5 }}>
                  {segment.shots.map((shot) => (
                    <button key={shot.id} onClick={() => setActiveShotId(shot.id)} style={{
                      border: "none",
                      background: activeShot?.id === shot.id ? "#fff" : "transparent",
                      borderRadius: 7,
                      padding: "7px 8px",
                      textAlign: "left",
                      color: activeShot?.id === shot.id ? C.text : C.sub,
                      cursor: "pointer",
                      fontSize: 12,
                    }}>
                      分镜 {shot.shotNumber} · {shot.sceneName || "未命名场景"}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {segments.length === 0 && <Empty title="还没有分镜。先到“剧本分集”生成分镜设计。" icon={<Clapperboard size={34} />} />}
        </div>
      </aside>
      <section style={{ minHeight: 0, display: "grid", gridTemplateRows: compact ? "auto auto auto" : "auto 160px 1fr", gap: 12 }}>
        <div style={card({ padding: 14 })}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 18 }}>视频段 {currentSegment ? `${String(currentSegment.segmentNumber).padStart(2, "0")} · ${currentSegment.duration}s` : "--"}</h1>
              <div style={{ ...tinyLabel(), marginTop: 5 }}>几个分镜镜头合成一条 15 秒左右 Seedance 2.0 提示词。</div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: compact ? "flex-start" : "flex-end" }}>
              <Button disabled={!segmentStats || segmentStats.nextAction === "done" || generateStoryboard.isPending || generateDiagram.isPending || generateSegmentPrompt.isPending || generateVideoSegment.isPending || generateVideo.isPending} onClick={runNextSegmentAction} style={{ background: C.ink, color: "#fff", borderRadius: 8 }}>
                {generateStoryboard.isPending || generateDiagram.isPending || generateSegmentPrompt.isPending || generateVideoSegment.isPending || generateVideo.isPending ? <Loader2 className="animate-spin" size={14} /> : <ChevronRight size={14} />}
                {segmentStats?.nextLabel ?? "下一步"}
              </Button>
              <Button variant="outline" disabled={!activeShot || generateStoryboard.isPending} onClick={() => activeShot && generateStoryboard.mutate({ shotId: activeShot.id, imageEngine: "image2", addToAssetLibrary: false })} style={{ borderColor: C.line, borderRadius: 8 }}>
                {generateStoryboard.isPending ? <Loader2 className="animate-spin" size={14} /> : <ImageIcon size={14} />}
                分镜草图
              </Button>
              <Button variant="outline" disabled={!activeShot || generateDiagram.isPending} onClick={() => activeShot && generateDiagram.mutate({ shotId: activeShot.id, imageEngine: "image2", addToAssetLibrary: false })} style={{ borderColor: C.line, borderRadius: 8 }}>
                {generateDiagram.isPending ? <Loader2 className="animate-spin" size={14} /> : <Camera size={14} />}
                机位图
              </Button>
            </div>
          </div>
          {segmentStats && (
          <div style={{ display: "grid", gridTemplateColumns: compact ? "repeat(auto-fit, minmax(110px, 1fr))" : "repeat(5, minmax(92px, 1fr))", gap: 8, marginTop: 12 }}>
              <SegmentStat label="分镜" value={`${segmentStats.shots} 个`} done />
              <SegmentStat label="参考图" value={`${segmentStats.references}/9`} done={segmentStats.references > 0} />
              <SegmentStat label="草图" value={`${segmentStats.storyboards}/${segmentStats.shots}`} done={segmentStats.storyboards === segmentStats.shots} />
              <SegmentStat label="机位" value={`${segmentStats.cameras}/${segmentStats.shots}`} done={segmentStats.cameras === segmentStats.shots} />
              <SegmentStat label="状态" value={segmentStats.statusLabel} done={segmentStats.nextAction === "done"} />
            </div>
          )}
          {currentError && (
            <div style={{ ...card({ padding: 10, marginTop: 10, background: "#fff7f5", borderColor: "#f1c7c0" }) }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: C.red, marginBottom: 4 }}>生成失败，可直接点击下一步重试</div>
              <div style={{ ...tinyLabel(C.red), lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{currentError}</div>
            </div>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(1, currentSegment?.shots.length ?? 1)}, minmax(120px, 1fr))`, gap: 10, minHeight: 0 }}>
          {(currentSegment?.shots ?? []).map((shot) => (
            <button key={shot.id} onClick={() => setActiveShotId(shot.id)} style={{ ...card({ padding: 8, cursor: "pointer", textAlign: "left", borderColor: activeShot?.id === shot.id ? "#d8ccff" : C.line }) }}>
              <div style={{ height: 82, background: C.panelSoft, borderRadius: 7, overflow: "hidden", display: "grid", placeItems: "center" }}>
                {shot.storyboardSketchUrl ? <img src={shot.storyboardSketchUrl} alt="分镜草图" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <ImageIcon size={22} style={{ color: C.dim }} />}
              </div>
              <div style={{ fontSize: 12, fontWeight: 900, marginTop: 7 }}>分镜 {shot.shotNumber}</div>
              <div style={{ ...tinyLabel(C.dim), marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shot.visualDescription || "暂无描述"}</div>
            </button>
          ))}
          {!currentSegment && <Empty title="暂无视频段" icon={<GalleryHorizontal size={34} />} />}
        </div>
        <div style={{ minHeight: 0, display: "grid", gridTemplateColumns: compact ? "1fr" : "1fr 1fr", gap: 12 }}>
          <section style={card({ padding: 14, minHeight: 0, display: "grid", gridTemplateRows: "auto 1fr", gap: 10 })}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 900 }}>当前分镜</div>
              <div style={tinyLabel()}>{focusShot && focusShot.id !== activeShot?.id ? `下一步建议处理分镜 ${focusShot.shotNumber}` : "动作、台词、情绪和表演留白"}</div>
            </div>
            {activeShot ? (
              <div style={{ minHeight: 0, overflow: "auto", display: "grid", alignContent: "start", gap: 10 }}>
                <InfoLine label="场景" value={activeShot.sceneName || "未命名场景"} />
                <InfoLine label="人物" value={activeShot.characters || "未指定"} />
                <InfoLine label="台词" value={activeShot.dialogue || "无台词"} />
                <InfoLine label="情绪" value={activeShot.emotion || "未指定"} />
                <div style={{ ...tinyLabel(C.text), whiteSpace: "pre-wrap", lineHeight: 1.7, background: C.panelSoft, borderRadius: 8, padding: 12 }}>{activeShot.visualDescription || "暂无镜头描述"}</div>
              </div>
            ) : <Empty title="选择一个视频段或分镜" icon={<FileText size={34} />} />}
          </section>
          <section style={card({ padding: 0, minHeight: 0, display: "grid", gridTemplateRows: "1fr auto", overflow: "hidden" })}>
            <div style={{ background: C.panelSoft, display: "grid", placeItems: "center", overflow: "hidden" }}>
              {currentSegment?.videoUrl || segmentLead?.videoUrl ? (
                <video src={currentSegment?.videoUrl || segmentLead?.videoUrl || ""} controls style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              ) : previewImage ? (
                <img src={previewImage} alt="预览" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              ) : (
                <div style={{ textAlign: "center", color: C.dim }}>
                  <Play size={36} />
                  <div style={{ marginTop: 8, fontSize: 12 }}>视频预览 / 分镜图 / 机位图</div>
                </div>
              )}
            </div>
            <SeedanceComposer
              disabled={!project || !currentSegment}
              prompt={segmentPrompt}
              onPrompt={setSegmentPrompt}
              duration={duration}
              onDuration={setDuration}
              tags={referenceTags}
              availableAssets={imageAssets}
              selectedAssets={selectedAssets}
              selectedAssetIds={selectedAssetIds}
              assetPickerOpen={assetPickerOpen}
              onAssetPickerOpen={setAssetPickerOpen}
              onToggleAsset={toggleAsset}
              onClearAssets={() => setSelectedAssetIds([])}
              isPrompting={generateSegmentPrompt.isPending}
              isGenerating={generateVideoSegment.isPending || generateVideo.isPending}
              onGeneratePrompt={() => {
                if (!project || !currentSegment) return;
                generateSegmentPrompt.mutate({
                  projectId: project.id,
                  segmentId: typeof currentSegment.id === "number" ? currentSegment.id : undefined,
                  shotIds: currentSegment.shots.map((shot) => shot.id),
                  referenceAssetIds: selectedAssetIds,
                  duration,
                });
              }}
              onGenerateVideo={() => {
                if (!segmentLead || !currentSegment) return;
                const aspectRatio = project?.aspectRatio === "landscape" ? "16:9" : "9:16";
                if (typeof currentSegment.id === "number") {
                  generateVideoSegment.mutate({
                    segmentId: currentSegment.id,
                    prompt: segmentPrompt,
                    referenceImageUrls: referenceUrls,
                    duration,
                    aspectRatio,
                  });
                } else {
                  generateVideo.mutate({
                    shotId: segmentLead.id,
                    prompt: segmentPrompt,
                    referenceImageUrls: referenceUrls,
                    duration,
                    aspectRatio,
                  });
                }
              }}
            />
          </section>
        </div>
      </section>
      <aside style={card({ padding: 14, minHeight: 0, display: "grid", gridTemplateRows: "auto auto 1fr auto", gap: 12 })}>
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 900 }}>资产引用面板</div>
            <span style={pill(selectedAssets.length > 0)}>{selectedAssets.length}/9</span>
          </div>
          <div style={{ ...tinyLabel(), marginTop: 5 }}>当前视频段最多引用 9 张固定参考图。</div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {referenceTags.map((tag) => <span key={tag} style={pill(true)}>{tag}</span>)}
          {referenceTags.length === 0 && <span style={pill()}>暂无引用</span>}
        </div>
        <div style={{ minHeight: 0, overflow: "auto", display: "grid", gap: 8, alignContent: "start" }}>
          {imageAssets.map((asset) => {
            const selected = selectedAssetIds.includes(asset.id);
            return (
              <button
                key={asset.id}
                onClick={() => toggleAsset(asset.id)}
                style={{ ...card({ padding: 8, display: "grid", gridTemplateColumns: "46px 1fr", gap: 10, cursor: "pointer", textAlign: "left", borderColor: selected ? "#d8ccff" : C.line, background: selected ? C.purpleSoft : C.panel }) }}
              >
                <div style={{ width: 46, height: 46, borderRadius: 7, background: C.panelSoft, overflow: "hidden", display: "grid", placeItems: "center" }}>
                  <img src={assetImage(asset)!} alt={asset.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{asset.name}</div>
                  <div style={{ ...tinyLabel(C.purple), marginTop: 4 }}>{assetTag(asset)}</div>
                </div>
              </button>
            );
          })}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <Button variant="outline" disabled={!activeShot?.storyboardSketchUrl || addVisual.isPending} onClick={() => activeShot && addVisual.mutate({ shotId: activeShot.id, kind: "storyboard" })} style={{ borderColor: C.line, borderRadius: 8 }}>
            <Plus size={14} /> 分镜入库
          </Button>
          <Button variant="outline" disabled={!activeShot?.cameraDiagramUrl || addVisual.isPending} onClick={() => activeShot && addVisual.mutate({ shotId: activeShot.id, kind: "camera_diagram" })} style={{ borderColor: C.line, borderRadius: 8 }}>
            <Plus size={14} /> 机位入库
          </Button>
        </div>
      </aside>
    </div>
  );
}

function SeedanceComposer({
  disabled,
  prompt,
  onPrompt,
  duration,
  onDuration,
  tags,
  availableAssets,
  selectedAssets,
  selectedAssetIds,
  assetPickerOpen,
  onAssetPickerOpen,
  onToggleAsset,
  onClearAssets,
  isPrompting,
  isGenerating,
  onGeneratePrompt,
  onGenerateVideo,
}: {
  disabled: boolean;
  prompt: string;
  onPrompt: (prompt: string) => void;
  duration: number;
  onDuration: (duration: number) => void;
  tags: string[];
  availableAssets: Asset[];
  selectedAssets: Asset[];
  selectedAssetIds: number[];
  assetPickerOpen: boolean;
  onAssetPickerOpen: (open: boolean) => void;
  onToggleAsset: (assetId: number) => void;
  onClearAssets: () => void;
  isPrompting: boolean;
  isGenerating: boolean;
  onGeneratePrompt: () => void;
  onGenerateVideo: () => void;
}) {
  const compact = useCompactLayout(720);
  const [assetFilter, setAssetFilter] = useState<AssetType | "all">("all");
  const filteredAssets = availableAssets.filter((asset) => assetFilter === "all" || asset.type === assetFilter);

  return (
    <div style={{ borderTop: `1px solid ${C.line}`, padding: 12, background: "#fff", display: "grid", gap: 9 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", minWidth: 0, paddingBottom: 2 }}>
          {selectedAssets.map((asset) => (
            <button
              key={asset.id}
              onClick={() => onToggleAsset(asset.id)}
              style={{
                border: `1px solid ${C.line}`,
                background: C.panel,
                borderRadius: 999,
                height: 34,
                padding: "4px 9px 4px 4px",
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                cursor: "pointer",
                flex: "0 0 auto",
                maxWidth: 170,
              }}
            >
              <img src={assetImage(asset)!} alt={asset.name} style={{ width: 26, height: 26, borderRadius: 999, objectFit: "cover" }} />
              <span style={{ fontSize: 12, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{assetTag(asset)}</span>
            </button>
          ))}
          {selectedAssets.length === 0 && (
            <button onClick={() => onAssetPickerOpen(true)} style={{ ...pill(), height: 34, cursor: "pointer" }}>
              <AtSign size={13} /> 添加人物、场景或分镜参考
            </button>
          )}
          {tags.filter((tag) => !selectedAssets.some((asset) => assetTag(asset) === tag)).slice(0, 4).map((tag) => <span key={tag} style={{ ...pill(true), height: 34 }}>{tag}</span>)}
        </div>
        {selectedAssets.length > 0 && (
          <button onClick={onClearAssets} style={{ ...pill(), height: 30, cursor: "pointer" }}>清空引用</button>
        )}
      </div>
      <Textarea
        value={prompt}
        onChange={(event) => onPrompt(event.target.value)}
        placeholder="描述这个视频段，或生成 15 秒 Seedance 2.0 提示词..."
        rows={5}
        style={{ ...field(), resize: "none", lineHeight: 1.6 }}
      />
      {assetPickerOpen && (
        <div style={card({ padding: 10, background: C.panelSoft })}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(["all", "character", "scene", "costume", "prop", "storyboard", "camera_diagram", "custom"] as Array<AssetType | "all">).map((type) => (
                <button key={type} onClick={() => setAssetFilter(type)} style={{ ...pill(assetFilter === type), cursor: "pointer" }}>{assetLabel[type]}</button>
              ))}
            </div>
            <button onClick={() => onAssetPickerOpen(false)} style={{ ...pill(), cursor: "pointer" }}>收起</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(132px, 1fr))", gap: 8, maxHeight: 154, overflow: "auto" }}>
            {filteredAssets.map((asset) => {
              const selected = selectedAssetIds.includes(asset.id);
              return (
                <button
                  key={asset.id}
                  onClick={() => onToggleAsset(asset.id)}
                  style={{
                    ...card({
                      padding: 7,
                      display: "grid",
                      gridTemplateColumns: "38px 1fr",
                      gap: 8,
                      alignItems: "center",
                      textAlign: "left",
                      cursor: "pointer",
                      borderColor: selected ? "#d8ccff" : C.line,
                      background: selected ? C.purpleSoft : C.panel,
                    }),
                  }}
                >
                  <div style={{ width: 38, height: 38, borderRadius: 7, background: "#fff", overflow: "hidden", display: "grid", placeItems: "center" }}>
                    <img src={assetImage(asset)!} alt={asset.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{asset.name}</div>
                    <div style={{ ...tinyLabel(selected ? C.purple : C.dim), marginTop: 3 }}>{assetLabel[asset.type]}</div>
                  </div>
                </button>
              );
            })}
            {filteredAssets.length === 0 && <div style={{ ...tinyLabel(), padding: 10 }}>该分类暂无可引用图片。</div>}
          </div>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button style={pill()}><Plus size={13} /></button>
        <button style={pill(true)}><Film size={13} /> 视频 2.0</button>
        <button style={pill(true)}><Sparkles size={13} /> Seedance 2.0</button>
        <button onClick={() => onAssetPickerOpen(!assetPickerOpen)} style={{ ...pill(assetPickerOpen), cursor: "pointer" }}><AtSign size={13} /> 资产</button>
        <button style={pill()}><ImageIcon size={13} /> 分镜图</button>
        <button style={pill()}><Camera size={13} /> 机位图</button>
        <Select value={String(duration)} onValueChange={(value) => onDuration(Number(value))}>
          <SelectTrigger style={{ ...field(), width: 92, height: 30, fontSize: 12 }}><SelectValue /></SelectTrigger>
          <SelectContent>
            {[8, 10, 12, 15].map((value) => <SelectItem key={value} value={String(value)}>{value}s</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" disabled={disabled || isPrompting} onClick={onGeneratePrompt} style={{ borderColor: C.line, borderRadius: 999, height: 32, flex: compact ? "1 1 160px" : undefined }}>
          {isPrompting ? <Loader2 className="animate-spin" size={14} /> : <Wand2 size={14} />}
          生成15秒提示词
        </Button>
        <Button disabled={disabled || !prompt.trim() || isGenerating} onClick={onGenerateVideo} style={{ background: C.ink, color: "#fff", borderRadius: 999, height: 34, marginLeft: compact ? 0 : "auto", flex: compact ? "1 1 120px" : undefined }}>
          {isGenerating ? <Loader2 className="animate-spin" size={14} /> : <ArrowUp size={14} />}
          生成
        </Button>
      </div>
    </div>
  );
}

function getSegmentStats(segment: VideoSegment, referenceCount: number, prompt: string) {
  const shots = segment.shots.length;
  const storyboards = segment.shots.filter((shot) => Boolean(shot.storyboardSketchUrl)).length;
  const cameras = segment.shots.filter((shot) => Boolean(shot.cameraDiagramUrl)).length;
  const hasPrompt = Boolean((segment.prompt || prompt).trim());
  const hasVideo = Boolean(segment.videoUrl || segment.shots[0]?.videoUrl);
  const missingStoryboardShot = segment.shots.find((shot) => !shot.storyboardSketchUrl);
  const missingCameraShot = segment.shots.find((shot) => !shot.cameraDiagramUrl);
  const hasError = segment.status === "failed" || segment.shots.some((shot) => shot.status === "failed");

  if (hasVideo) {
    return { shots, storyboards, cameras, references: referenceCount, statusLabel: "已出片", nextAction: "done" as const, nextLabel: "查看结果" };
  }
  if (missingStoryboardShot) {
    return { shots, storyboards, cameras, references: referenceCount, statusLabel: hasError ? "草图失败" : "补草图", nextAction: "storyboard" as const, nextLabel: hasError ? `重试分镜${missingStoryboardShot.shotNumber}草图` : `生成分镜${missingStoryboardShot.shotNumber}草图` };
  }
  if (missingCameraShot) {
    return { shots, storyboards, cameras, references: referenceCount, statusLabel: hasError ? "机位失败" : "补机位", nextAction: "camera" as const, nextLabel: hasError ? `重试分镜${missingCameraShot.shotNumber}机位` : `生成分镜${missingCameraShot.shotNumber}机位` };
  }
  if (referenceCount === 0) {
    return { shots, storyboards, cameras, references: referenceCount, statusLabel: "缺参考", nextAction: "asset" as const, nextLabel: "添加参考资产" };
  }
  if (!hasPrompt) {
    return { shots, storyboards, cameras, references: referenceCount, statusLabel: hasError ? "提示词失败" : "待提示词", nextAction: "prompt" as const, nextLabel: hasError ? "重试提示词" : "生成15秒提示词" };
  }
  return { shots, storyboards, cameras, references: referenceCount, statusLabel: hasError ? "视频失败" : "可出片", nextAction: "video" as const, nextLabel: hasError ? "重试Seedance视频" : "生成Seedance视频" };
}

function SegmentStat({ label, value, done }: { label: string; value: string; done: boolean }) {
  return (
    <div style={{ ...card({ padding: "9px 10px", background: done ? "#f4fbf7" : C.panelSoft, borderColor: done ? "#cfe8dc" : C.line }) }}>
      <div style={tinyLabel(done ? C.green : C.dim)}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 900, marginTop: 3 }}>{value}</div>
    </div>
  );
}

function GenerationRecordsView({ project, shots }: { project?: Project; shots: Shot[] }) {
  const compact = useCompactLayout();
  const { data: segmentData = [] } = trpc.overseas.listVideoSegments.useQuery(
    { projectId: project?.id ?? 0 },
    { enabled: Boolean(project?.id && shots.length > 0), refetchOnWindowFocus: false }
  );
  const segments = (segmentData as VideoSegment[]).filter((segment) => segment.shots?.length || segment.shotIds?.length);
  const shotRecords = shots.flatMap((shot) => [
    shot.storyboardSketchUrl ? { id: `storyboard-${shot.id}`, type: "分镜草图", scope: `EP${shot.episodeNumber} · 分镜${shot.shotNumber}`, status: "成功", summary: shot.visualDescription || "分镜草图", prompt: shot.storyboardPrompt, result: shot.storyboardSketchUrl, error: null } : null,
    shot.cameraDiagramUrl ? { id: `camera-${shot.id}`, type: "机位图", scope: `EP${shot.episodeNumber} · 分镜${shot.shotNumber}`, status: "成功", summary: shot.visualDescription || "机位示意图", prompt: shot.cameraDiagramPrompt, result: shot.cameraDiagramUrl, error: null } : null,
    shot.status === "failed" ? { id: `failed-shot-${shot.id}`, type: "分镜任务", scope: `EP${shot.episodeNumber} · 分镜${shot.shotNumber}`, status: "失败", summary: shot.visualDescription || "生成失败", prompt: shot.videoPrompt || shot.storyboardPrompt || shot.cameraDiagramPrompt, result: null, error: shot.errorMessage } : null,
  ].filter(Boolean)) as Array<RecordItem>;
  const segmentRecords = segments.flatMap((segment) => {
    const shotCount = segment.shots?.length ?? segment.shotIds?.length ?? 0;
    const scope = `EP${segment.episodeNumber} · 视频段${String(segment.segmentNumber).padStart(2, "0")}`;
    return [
      segment.prompt ? { id: `segment-prompt-${segment.id}`, type: "15秒提示词", scope, status: "成功", summary: `包含 ${shotCount} 个分镜 · ${segment.duration}s`, prompt: segment.prompt, result: null, error: null } : null,
      segment.videoUrl ? { id: `segment-video-${segment.id}`, type: "Seedance视频", scope, status: "成功", summary: `包含 ${shotCount} 个分镜 · ${segment.duration}s`, prompt: segment.prompt, result: segment.videoUrl, error: null } : null,
      segment.status === "failed" ? { id: `failed-segment-${segment.id}`, type: "视频段任务", scope, status: "失败", summary: `包含 ${shotCount} 个分镜 · ${segment.duration}s`, prompt: segment.prompt, result: segment.videoUrl ?? null, error: segment.errorMessage } : null,
    ].filter(Boolean);
  }) as Array<RecordItem>;
  const records = [...segmentRecords, ...shotRecords];
  const counts = {
    total: records.length,
    prompts: records.filter((record) => record.type === "15秒提示词").length,
    videos: records.filter((record) => record.type === "Seedance视频").length,
    failed: records.filter((record) => record.status === "失败").length,
    visuals: records.filter((record) => record.type === "分镜草图" || record.type === "机位图").length,
  };

  return (
    <div style={{ height: compact ? "auto" : "calc(100vh - 64px)", minHeight: compact ? "calc(100vh - 136px)" : undefined, padding: compact ? 14 : 22, display: "grid", gridTemplateColumns: compact ? "1fr" : "1fr 340px", gap: 16, overflow: compact ? "auto" : "hidden" }}>
      <section style={card({ padding: 18, minHeight: 0, display: "grid", gridTemplateRows: "auto auto 1fr", gap: 14 })}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20 }}>生成记录</h1>
          <div style={tinyLabel()}>轻量任务记录：查看、重试、复制提示词、加入资产库。</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            `全部 ${counts.total}`,
            `提示词 ${counts.prompts}`,
            `视频 ${counts.videos}`,
            `视觉图 ${counts.visuals}`,
            `失败 ${counts.failed}`,
          ].map((item, index) => <span key={item} style={pill(index === 0)}>{item}</span>)}
        </div>
        <div style={{ minHeight: 0, overflow: "auto", display: "grid", gap: 10, alignContent: "start" }}>
          {records.map((record) => (
            <div key={record.id} style={card({ padding: 12, display: "grid", gridTemplateColumns: compact ? "1fr" : "140px 1fr 86px 176px", alignItems: "center", gap: 12, borderColor: record.status === "失败" ? "#f1c7c0" : C.line, background: record.status === "失败" ? "#fff7f5" : C.panel })}>
              <div>
                <strong style={{ fontSize: 13 }}>{record.type}</strong>
                <div style={{ ...tinyLabel(C.dim), marginTop: 4 }}>{record.scope}</div>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ ...tinyLabel(C.text), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{record.summary}</div>
                {record.error && <div style={{ ...tinyLabel(C.red), marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{record.error}</div>}
              </div>
              <span style={pill(record.status === "成功")}>{record.status}</span>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <Button variant="outline" size="sm" disabled={!record.prompt} onClick={() => copy(record.prompt)} style={{ borderColor: C.line, borderRadius: 8 }}>
                  <Copy size={13} /> 提示词
                </Button>
                <Button variant="outline" size="sm" disabled={!record.result} onClick={() => record.result && window.open(record.result, "_blank")} style={{ borderColor: C.line, borderRadius: 8 }}>
                  <Play size={13} /> 查看
                </Button>
              </div>
            </div>
          ))}
          {records.length === 0 && <Empty title={project ? "还没有生成记录。" : "请先选择项目。"} icon={<Clock size={36} />} />}
        </div>
      </section>
      <aside style={card({ padding: 16, alignSelf: "start" })}>
        <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 10 }}>结果管理</div>
        <div style={{ display: "grid", gap: 8 }}>
          <Metric label="视频段" value={String(segments.length)} />
          <Metric label="成功视频" value={String(counts.videos)} />
          <Metric label="失败任务" value={String(counts.failed)} />
        </div>
        <div style={{ ...tinyLabel(), lineHeight: 1.7, marginTop: 12 }}>
          失败任务会保留原因；回到“镜头工作台”后，当前视频段顶部会出现重试按钮。
        </div>
      </aside>
    </div>
  );
}

type RecordItem = {
  id: string;
  type: string;
  scope: string;
  status: "成功" | "失败";
  summary: string;
  prompt: string | null | undefined;
  result: string | null;
  error: string | null | undefined;
};

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={tinyLabel(C.dim)}>{label}</div>
      <div style={{ fontSize: 13, marginTop: 4, lineHeight: 1.55 }}>{value}</div>
    </div>
  );
}

function Empty({ title, icon }: { title: string; icon: ReactNode }) {
  return (
    <div style={{ minHeight: 220, display: "grid", placeItems: "center", color: C.dim, textAlign: "center" }}>
      <div>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>{icon}</div>
        <div style={{ fontSize: 13 }}>{title}</div>
      </div>
    </div>
  );
}
