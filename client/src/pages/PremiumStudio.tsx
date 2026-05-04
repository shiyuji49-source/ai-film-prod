import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft,
  Boxes,
  Camera,
  Check,
  Clapperboard,
  Copy,
  FileText,
  Film,
  ImageIcon,
  KeyRound,
  Layers,
  Loader2,
  Play,
  Plus,
  Save,
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
  bg: "oklch(0.12 0.004 80)",
  band: "oklch(0.16 0.006 80)",
  panel: "oklch(0.19 0.008 80)",
  panel2: "oklch(0.23 0.01 85)",
  line: "oklch(0.32 0.01 85)",
  line2: "oklch(0.42 0.012 85)",
  text: "oklch(0.94 0.006 80)",
  sub: "oklch(0.72 0.012 95)",
  dim: "oklch(0.55 0.012 95)",
  gold: "oklch(0.80 0.15 76)",
  blue: "oklch(0.68 0.13 235)",
  green: "oklch(0.72 0.16 155)",
  rose: "oklch(0.70 0.18 20)",
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
  mjPrompt: string | null;
  stylePrompt: string | null;
  referenceImageUrl: string | null;
  mainImageUrl: string | null;
  mjImageUrl: string | null;
  viewCloseUpUrl: string | null;
  multiAngleGridUrl: string | null;
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

type TabKey = "definition" | "script" | "assets" | "storyboard" | "video";

const tabs: Array<{ key: TabKey; label: string; icon: ReactNode }> = [
  { key: "definition", label: "项目定义", icon: <Film size={15} /> },
  { key: "script", label: "剧本分集", icon: <FileText size={15} /> },
  { key: "assets", label: "资产库", icon: <Boxes size={15} /> },
  { key: "storyboard", label: "分镜草图", icon: <ImageIcon size={15} /> },
  { key: "video", label: "视频生成", icon: <Play size={15} /> },
];

const assetLabel: Record<AssetType, string> = {
  character: "演员",
  scene: "场景",
  prop: "道具",
  costume: "服化道",
  storyboard: "分镜草图",
  camera_diagram: "机位图",
  custom: "自定义",
};

function panel(style?: CSSProperties): CSSProperties {
  return {
    background: C.panel,
    border: `1px solid ${C.line}`,
    borderRadius: 8,
    ...style,
  };
}

function field(): CSSProperties {
  return {
    background: C.band,
    borderColor: C.line,
    color: C.text,
  };
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function assetImage(asset: Asset) {
  return asset.referenceImageUrl || asset.viewCloseUpUrl || asset.mainImageUrl || asset.multiAngleGridUrl || asset.mjImageUrl;
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

  if (me.isLoading || status.isLoading) {
    return <LoadingScreen />;
  }

  if (me.data) return <>{children}</>;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, display: "grid", placeItems: "center", padding: 20 }}>
      <section style={panel({ width: "min(420px, 100%)", padding: 24 })}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <KeyRound size={24} style={{ color: C.gold }} />
          <div>
            <h1 style={{ margin: 0, fontSize: 20 }}>鎏光机内部访问</h1>
            <div style={{ color: C.sub, fontSize: 12, marginTop: 4 }}>输入内部访问密码进入工作台</div>
          </div>
        </div>
        {!status.data?.configured ? (
          <div style={{ color: C.rose, fontSize: 13, lineHeight: 1.7 }}>服务器还没有配置内部访问密码。</div>
        ) : (
          <form
            style={{ display: "grid", gap: 12 }}
            onSubmit={(event) => {
              event.preventDefault();
              login.mutate({ password });
            }}
          >
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="访问密码"
              style={field()}
            />
            <Button disabled={!password || login.isPending} style={{ background: C.gold, color: C.bg, fontWeight: 800 }}>
              {login.isPending ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />}
              进入
            </Button>
          </form>
        )}
      </section>
    </div>
  );
}

function StudioShell() {
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);
  if (!activeProjectId) return <ProjectBoard onOpen={setActiveProjectId} />;
  return <Workspace projectId={activeProjectId} onBack={() => setActiveProjectId(null)} />;
}

function LoadingScreen() {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, display: "grid", placeItems: "center" }}>
      <Loader2 className="animate-spin" style={{ color: C.gold }} />
    </div>
  );
}

function ProjectBoard({ onOpen }: { onOpen: (id: number) => void }) {
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [definition, setDefinition] = useState("");
  const [aspectRatio, setAspectRatio] = useState<Project["aspectRatio"]>("portrait");
  const [presetId, setPresetId] = useState("natural_practical_light");
  const [enhancerIds, setEnhancerIds] = useState<string[]>([]);
  const preset = getVisualStylePreset(presetId);
  const enhancerState = validateStyleEnhancers(enhancerIds);
  const visualStylePrompt = buildVisualStylePrompt(preset, enhancerState.selectedIds);
  const { data: projects = [], isLoading } = trpc.overseas.listProjects.useQuery();
  const createProject = trpc.overseas.createProject.useMutation({
    onSuccess: async (project) => {
      toast.success("新项目已创建");
      await utils.overseas.listProjects.invalidate();
      onOpen(project.id);
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, display: "grid", gridTemplateRows: "64px 1fr" }}>
      <header style={{ background: C.band, borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Clapperboard size={22} style={{ color: C.gold }} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>鎏光机精品剧工作台</div>
            <div style={{ fontSize: 12, color: C.sub }}>Seedance 2.0 · gpt-image-2 · 摄影风格预设</div>
          </div>
        </div>
      </header>
      <main style={{ padding: 22, display: "grid", gridTemplateColumns: "380px 1fr", gap: 18, minHeight: 0 }}>
        <section style={panel({ padding: 18, alignSelf: "start" })}>
          <h2 style={{ margin: "0 0 14px", fontSize: 16 }}>新建项目</h2>
          <div style={{ display: "grid", gap: 11 }}>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="项目名称" style={field()} />
            <Textarea value={definition} onChange={(event) => setDefinition(event.target.value)} placeholder="一句话故事、核心人物关系、必须保留或禁止的内容" rows={5} style={field()} />
            <Select value={aspectRatio} onValueChange={(value) => setAspectRatio(value as Project["aspectRatio"])}>
              <SelectTrigger style={field()}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="portrait">9:16 竖屏</SelectItem>
                <SelectItem value="landscape">16:9 横屏</SelectItem>
              </SelectContent>
            </Select>
            <StylePresetSelect value={presetId} onValueChange={setPresetId} />
            <StyleEnhancerPicker value={enhancerState.selectedIds} onChange={setEnhancerIds} />
            <div style={{ color: C.dim, fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-wrap", maxHeight: 120, overflow: "auto" }}>{visualStylePrompt}</div>
            {enhancerState.warnings.length > 0 && <div style={{ color: C.gold, fontSize: 12, lineHeight: 1.6 }}>{enhancerState.warnings.join(" ")}</div>}
            <Button
              disabled={!name.trim() || createProject.isPending}
              onClick={() => createProject.mutate({
                name,
                definition,
                market: "cn",
                aspectRatio,
                style: "realistic",
                genre: preset.id,
                visualStylePreset: preset.id,
                styleEnhancers: JSON.stringify(enhancerState.selectedIds),
                visualStylePrompt,
                projectType: "premium",
              })}
              style={{ background: C.gold, color: C.bg, fontWeight: 900 }}
            >
              {createProject.isPending ? <Loader2 className="animate-spin" size={15} /> : <Plus size={15} />}
              创建精品剧
            </Button>
          </div>
        </section>
        <section style={{ minHeight: 0, overflow: "auto" }}>
          {isLoading ? <LoadingScreen /> : (projects as Project[]).length === 0 ? (
            <div style={panel({ height: "100%", minHeight: 360, display: "grid", placeItems: "center", color: C.dim })}>暂无项目</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
              {(projects as Project[]).map((project) => {
                const style = getVisualStylePreset(project.visualStylePreset);
                return (
                  <button key={project.id} onClick={() => onOpen(project.id)} style={{ ...panel({ padding: 16, textAlign: "left", cursor: "pointer" }) }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{project.name}</div>
                        <div style={{ color: C.sub, fontSize: 12, marginTop: 5 }}>{project.aspectRatio === "portrait" ? "9:16" : "16:9"} · {style.name}</div>
                      </div>
                      <Sparkles size={16} style={{ color: C.gold, flexShrink: 0 }} />
                    </div>
                    <div style={{ color: C.dim, fontSize: 12, lineHeight: 1.6, marginTop: 14, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {project.definition || "未填写项目定义"}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Workspace({ projectId, onBack }: { projectId: number; onBack: () => void }) {
  const [tab, setTab] = useState<TabKey>("definition");
  const [episode, setEpisode] = useState(1);
  const { data, refetch } = trpc.overseas.getProject.useQuery({ id: projectId });
  const project = data?.project as Project | undefined;
  const shots = (data?.shots ?? []) as Shot[];
  const maxEpisode = Math.max(1, ...shots.map((shot) => shot.episodeNumber));

  useEffect(() => {
    if (shots.length > 0 && !shots.some((shot) => shot.episodeNumber === episode)) {
      setEpisode(shots[0].episodeNumber);
    }
  }, [episode, shots]);

  if (!project) return <LoadingScreen />;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, display: "grid", gridTemplateRows: "64px 1fr" }}>
      <header style={{ background: C.band, borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBack} style={{ border: "none", background: "transparent", color: C.sub, display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
            <ArrowLeft size={16} /> 项目
          </button>
          <div style={{ width: 1, height: 24, background: C.line }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 900 }}>{project.name}</div>
            <div style={{ color: C.sub, fontSize: 12 }}>{project.aspectRatio === "portrait" ? "9:16" : "16:9"} · {getVisualStylePreset(project.visualStylePreset).name}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8, padding: 4 }}>
          {tabs.map((item) => (
            <button key={item.key} onClick={() => setTab(item.key)} style={{
              height: 34,
              padding: "0 11px",
              border: "none",
              borderRadius: 6,
              background: tab === item.key ? C.gold : "transparent",
              color: tab === item.key ? C.bg : C.sub,
              display: "flex",
              alignItems: "center",
              gap: 6,
              cursor: "pointer",
              fontWeight: 800,
              fontSize: 12,
            }}>
              {item.icon}{item.label}
            </button>
          ))}
        </div>
      </header>
      <main style={{ minHeight: 0 }}>
        {tab === "definition" && <DefinitionPanel project={project} onSaved={refetch} />}
        {tab === "script" && <ScriptPanel project={project} activeEpisode={episode} onEpisodeChange={setEpisode} onChanged={refetch} />}
        {tab === "assets" && <AssetsPanel project={project} />}
        {tab === "storyboard" && <StoryboardPanel project={project} activeEpisode={episode} maxEpisode={maxEpisode} onEpisodeChange={setEpisode} />}
        {tab === "video" && <VideoPanel project={project} activeEpisode={episode} maxEpisode={maxEpisode} onEpisodeChange={setEpisode} />}
      </main>
    </div>
  );
}

function StylePresetSelect({ value, onValueChange }: { value: string; onValueChange: (value: string) => void }) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger style={field()}><SelectValue /></SelectTrigger>
      <SelectContent>
        {VISUAL_STYLE_PRESETS.map((preset) => (
          <SelectItem key={preset.id} value={preset.id}>{preset.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function StyleEnhancerPicker({ value, onChange }: { value: string[]; onChange: (value: string[]) => void }) {
  const toggle = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter((item) => item !== id));
      return;
    }
    if (value.length >= 5) {
      toast.warning("增强标签最多选择 5 个");
      return;
    }
    onChange([...value, id]);
  };

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ color: C.sub, fontSize: 12 }}>摄影增强标签（最多 5 个）</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {STYLE_ENHANCERS.map((item) => {
          const selected = value.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => toggle(item.id)}
              title={item.prompt}
              style={{
                minHeight: 28,
                borderRadius: 6,
                border: `1px solid ${selected ? C.gold : C.line}`,
                background: selected ? "oklch(0.24 0.035 75)" : C.band,
                color: selected ? C.gold : C.sub,
                cursor: "pointer",
                fontSize: 12,
                padding: "4px 8px",
                lineHeight: 1.2,
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DefinitionPanel({ project, onSaved }: { project: Project; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: project.name,
    definition: project.definition ?? "",
    aspectRatio: project.aspectRatio,
    visualStylePreset: project.visualStylePreset,
    styleEnhancers: parseStyleEnhancers(project.styleEnhancers),
    visualStylePrompt: project.visualStylePrompt || buildVisualStylePrompt(getVisualStylePreset(project.visualStylePreset), parseStyleEnhancers(project.styleEnhancers)),
    projectBible: project.projectBible ?? "",
  });
  const selectedPreset = getVisualStylePreset(form.visualStylePreset);
  const enhancerState = validateStyleEnhancers(form.styleEnhancers);
  const update = trpc.overseas.updateProject.useMutation({
    onSuccess: () => {
      toast.success("项目定义已保存");
      onSaved();
    },
    onError: (err) => toast.error(err.message),
  });

  const selectPreset = (presetId: string) => {
    const nextPreset = getVisualStylePreset(presetId);
    setForm((prev) => ({
      ...prev,
      visualStylePreset: presetId,
      visualStylePrompt: buildVisualStylePrompt(nextPreset, prev.styleEnhancers),
    }));
  };

  const selectEnhancers = (styleEnhancers: string[]) => {
    const { selectedIds } = validateStyleEnhancers(styleEnhancers);
    setForm((prev) => ({
      ...prev,
      styleEnhancers: selectedIds,
      visualStylePrompt: buildVisualStylePrompt(getVisualStylePreset(prev.visualStylePreset), selectedIds),
    }));
  };

  return (
    <div style={{ padding: 18, height: "calc(100vh - 64px)", display: "grid", gridTemplateColumns: "minmax(420px, 620px) 1fr", gap: 16 }}>
      <section style={panel({ padding: 16, overflow: "auto" })}>
        <h2 style={{ margin: "0 0 14px", fontSize: 16 }}>项目定义</h2>
        <div style={{ display: "grid", gap: 11 }}>
          <Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} style={field()} />
          <Textarea value={form.definition} onChange={(event) => setForm((prev) => ({ ...prev, definition: event.target.value }))} rows={6} style={field()} placeholder="一句话故事、核心人物关系、必须保留或禁止的内容" />
          <Select value={form.aspectRatio} onValueChange={(value) => setForm((prev) => ({ ...prev, aspectRatio: value as Project["aspectRatio"] }))}>
            <SelectTrigger style={field()}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="portrait">9:16 竖屏</SelectItem>
              <SelectItem value="landscape">16:9 横屏</SelectItem>
            </SelectContent>
          </Select>
          <StylePresetSelect value={form.visualStylePreset} onValueChange={selectPreset} />
          <StyleEnhancerPicker value={enhancerState.selectedIds} onChange={selectEnhancers} />
          {enhancerState.warnings.length > 0 && <div style={{ color: C.gold, fontSize: 12, lineHeight: 1.6 }}>{enhancerState.warnings.join(" ")}</div>}
          <Textarea value={form.visualStylePrompt} onChange={(event) => setForm((prev) => ({ ...prev, visualStylePrompt: event.target.value }))} rows={10} style={{ ...field(), lineHeight: 1.6 }} />
          <Button
            disabled={update.isPending}
            onClick={() => update.mutate({
              id: project.id,
              name: form.name,
              definition: form.definition,
              aspectRatio: form.aspectRatio,
              market: "cn",
              style: "realistic",
              genre: selectedPreset.id,
              visualStylePreset: selectedPreset.id,
              styleEnhancers: JSON.stringify(enhancerState.selectedIds),
              visualStylePrompt: form.visualStylePrompt,
              projectBible: form.projectBible,
              projectType: "premium",
              videoEngine: "seedance_2_0",
            })}
            style={{ background: C.gold, color: C.bg, fontWeight: 900, justifySelf: "start" }}
          >
            {update.isPending ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />}
            保存
          </Button>
        </div>
      </section>
      <section style={panel({ padding: 16, overflow: "auto", display: "grid", gridTemplateRows: "auto 1fr", gap: 12 })}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16 }}>项目圣经</h2>
          <div style={{ color: C.sub, fontSize: 12, marginTop: 6 }}>剧本页生成后会写入这里，也可以人工修改。</div>
        </div>
        <Textarea value={form.projectBible} onChange={(event) => setForm((prev) => ({ ...prev, projectBible: event.target.value }))} style={{ ...field(), minHeight: 0, resize: "none", lineHeight: 1.7 }} />
      </section>
    </div>
  );
}

function ScriptPanel({ project, activeEpisode, onEpisodeChange, onChanged }: {
  project: Project;
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
      toast.success(`已识别 ${data.episodes.length} 集`);
    },
    onError: (err) => toast.error(err.message),
  });
  const bible = trpc.overseas.generateProjectBible.useMutation({
    onSuccess: async () => {
      toast.success("项目圣经已生成");
      await utils.overseas.getProject.invalidate({ id: project.id });
      onChanged();
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
    if (!job || job.status !== "done") return;
    toast.success(`分镜设计完成：${job.succeeded}/${job.total}`);
    setJobId(null);
    utils.overseas.getProject.invalidate({ id: project.id });
    utils.overseas.listShots.invalidate();
    onChanged();
  }, [job, onChanged, project.id, utils]);

  const sourceEpisodes = episodes.length > 0
    ? episodes
    : [{ episodeNumber: activeEpisode, title: `第 ${activeEpisode} 集`, scriptText }];

  const startStoryboard = () => {
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

  return (
    <div style={{ padding: 18, height: "calc(100vh - 64px)", display: "grid", gridTemplateColumns: "minmax(460px, 1fr) 420px", gap: 16 }}>
      <section style={panel({ padding: 16, display: "grid", gridTemplateRows: "auto 1fr auto", gap: 12, minHeight: 0 })}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>剧本导入</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="outline" disabled={bible.isPending || !scriptText.trim()} onClick={() => bible.mutate({ projectId: project.id, scriptText })} style={{ borderColor: C.line2, color: C.sub }}>
              {bible.isPending ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />} 项目圣经
            </Button>
            <Button variant="outline" disabled={splitScript.isPending || !scriptText.trim()} onClick={() => splitScript.mutate({ projectId: project.id, scriptText })} style={{ borderColor: C.line2, color: C.sub }}>
              {splitScript.isPending ? <Loader2 className="animate-spin" size={14} /> : <Layers size={14} />} 智能分集
            </Button>
            <Button disabled={batchParse.isPending || !!jobId} onClick={startStoryboard} style={{ background: C.gold, color: C.bg, fontWeight: 900 }}>
              {batchParse.isPending || jobId ? <Loader2 className="animate-spin" size={14} /> : <Wand2 size={14} />} 分镜设计
            </Button>
          </div>
        </div>
        <Textarea value={scriptText} onChange={(event) => setScriptText(event.target.value)} placeholder="粘贴剧本。已有“第X集 / EP X”标记时会优先按原标记切分。" style={{ ...field(), minHeight: 0, resize: "none", lineHeight: 1.7 }} />
        {jobId && job && <div style={{ color: C.sub, fontSize: 12 }}>{job.currentName} · {job.current}/{job.total}</div>}
      </section>
      <section style={panel({ padding: 16, overflow: "auto" })}>
        <h2 style={{ margin: "0 0 12px", fontSize: 16 }}>分集结果</h2>
        {episodes.length === 0 ? (
          <div style={{ color: C.dim, fontSize: 13, lineHeight: 1.7 }}>智能分集后会显示在这里。分镜设计会自动读取这些分集。</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {episodes.map((episode) => (
              <button key={episode.episodeNumber} onClick={() => onEpisodeChange(episode.episodeNumber)} style={{
                ...panel({ padding: 12, background: activeEpisode === episode.episodeNumber ? "oklch(0.24 0.035 75)" : C.panel2, textAlign: "left", cursor: "pointer" }),
              }}>
                <div style={{ fontSize: 13, fontWeight: 900 }}>第 {episode.episodeNumber} 集 · {episode.title}</div>
                <div style={{ color: C.dim, fontSize: 12, lineHeight: 1.55, marginTop: 6, display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{episode.scriptText}</div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function AssetsPanel({ project }: { project: Project }) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState<{ type: AssetType; name: string; description: string; file: File | null }>({
    type: "custom",
    name: "",
    description: "",
    file: null,
  });
  const { data = [] } = trpc.overseas.listAssets.useQuery({ projectId: project.id });
  const create = trpc.overseas.createAsset.useMutation();
  const upload = trpc.overseas.uploadAssetToS3.useMutation();
  const remove = trpc.overseas.deleteAsset.useMutation({
    onSuccess: () => utils.overseas.listAssets.invalidate({ projectId: project.id }),
  });

  const submit = async () => {
    if (!form.name.trim()) return;
    try {
      const asset = await create.mutateAsync({
        projectId: project.id,
        type: form.type,
        name: form.name,
        description: form.description,
      });
      if (form.file) {
        const fileBase64 = await fileToBase64(form.file);
        await upload.mutateAsync({
          assetId: asset.id,
          field: "referenceImageUrl",
          fileBase64,
          contentType: form.file.type || "image/png",
          fileName: form.file.name,
        });
      }
      toast.success("资产已添加");
      setForm({ type: "custom", name: "", description: "", file: null });
      await utils.overseas.listAssets.invalidate({ projectId: project.id });
    } catch (err: any) {
      toast.error(err.message || "添加失败");
    }
  };

  return (
    <div style={{ padding: 18, height: "calc(100vh - 64px)", display: "grid", gridTemplateColumns: "340px 1fr", gap: 16 }}>
      <section style={panel({ padding: 16, alignSelf: "start" })}>
        <h2 style={{ margin: "0 0 12px", fontSize: 16 }}>添加资产</h2>
        <div style={{ display: "grid", gap: 10 }}>
          <Select value={form.type} onValueChange={(type) => setForm((prev) => ({ ...prev, type: type as AssetType }))}>
            <SelectTrigger style={field()}><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(assetLabel).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
          </Select>
          <Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="资产名称" style={field()} />
          <Textarea value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="外观、用途、连续性要求" rows={4} style={field()} />
          <label style={{ ...panel({ padding: 12, display: "flex", gap: 8, alignItems: "center", cursor: "pointer", color: C.sub }) }}>
            <Upload size={15} style={{ color: C.gold }} />
            <span style={{ fontSize: 12 }}>{form.file ? form.file.name : "上传参考图"}</span>
            <input hidden type="file" accept="image/*" onChange={(event) => setForm((prev) => ({ ...prev, file: event.target.files?.[0] ?? null }))} />
          </label>
          <Button disabled={!form.name.trim() || create.isPending || upload.isPending} onClick={submit} style={{ background: C.gold, color: C.bg, fontWeight: 900 }}>
            {create.isPending || upload.isPending ? <Loader2 className="animate-spin" size={15} /> : <Plus size={15} />} 添加
          </Button>
        </div>
      </section>
      <section style={{ minHeight: 0, overflow: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
          {(data as Asset[]).map((asset) => {
            const image = assetImage(asset);
            return (
              <article key={asset.id} style={panel({ overflow: "hidden" })}>
                <div style={{ height: 140, background: C.band, display: "grid", placeItems: "center", borderBottom: `1px solid ${C.line}` }}>
                  {image ? <img src={image} alt={asset.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <ImageIcon size={28} style={{ color: C.dim }} />}
                </div>
                <div style={{ padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 900 }}>{asset.name}</div>
                      <div style={{ color: C.dim, fontSize: 11, marginTop: 4 }}>{assetLabel[asset.type]}</div>
                    </div>
                    <button onClick={() => remove.mutate({ id: asset.id })} style={{ border: "none", background: "transparent", color: C.dim, cursor: "pointer" }}><Trash2 size={14} /></button>
                  </div>
                  <div style={{ color: C.sub, fontSize: 12, lineHeight: 1.55, marginTop: 10, minHeight: 38 }}>{asset.description || "暂无描述"}</div>
                  {(asset.mjPrompt || asset.stylePrompt) && (
                    <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                      <div style={{ color: C.dim, fontSize: 11 }}>资产提示词</div>
                      <div style={{ color: C.sub, fontSize: 11, lineHeight: 1.5, maxHeight: 74, overflow: "auto", whiteSpace: "pre-wrap", background: C.band, border: `1px solid ${C.line}`, borderRadius: 6, padding: 8 }}>
                        {asset.mjPrompt || asset.stylePrompt}
                      </div>
                      <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(asset.mjPrompt || asset.stylePrompt || "")} style={{ borderColor: C.line2, color: C.sub, justifySelf: "start" }}>
                        <Copy size={13} /> 复制
                      </Button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function EpisodeStepper({ activeEpisode, maxEpisode, onChange }: { activeEpisode: number; maxEpisode: number; onChange: (episode: number) => void }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {Array.from({ length: maxEpisode }, (_, index) => index + 1).map((episode) => (
        <button key={episode} onClick={() => onChange(episode)} style={{
          height: 28,
          minWidth: 34,
          borderRadius: 6,
          border: `1px solid ${activeEpisode === episode ? C.gold : C.line}`,
          background: activeEpisode === episode ? "oklch(0.24 0.035 75)" : C.band,
          color: activeEpisode === episode ? C.gold : C.sub,
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 800,
        }}>{episode}</button>
      ))}
    </div>
  );
}

function ShotList({ shots, activeId, onSelect }: { shots: Shot[]; activeId: number | null; onSelect: (id: number) => void }) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {shots.map((shot) => (
        <button key={shot.id} onClick={() => onSelect(shot.id)} style={{
          ...panel({ padding: 10, textAlign: "left", cursor: "pointer", background: activeId === shot.id ? "oklch(0.24 0.035 75)" : C.panel2 }),
        }}>
          <div style={{ fontSize: 12, fontWeight: 900 }}>镜头 {shot.episodeNumber}.{shot.shotNumber} · {shot.videoDuration ?? 12}s</div>
          <div style={{ color: C.dim, fontSize: 11, lineHeight: 1.45, marginTop: 5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{shot.visualDescription}</div>
        </button>
      ))}
    </div>
  );
}

function StoryboardPanel({ project, activeEpisode, maxEpisode, onEpisodeChange }: {
  project: Project;
  activeEpisode: number;
  maxEpisode: number;
  onEpisodeChange: (episode: number) => void;
}) {
  const utils = trpc.useUtils();
  const [activeShotId, setActiveShotId] = useState<number | null>(null);
  const { data = [], refetch } = trpc.overseas.listShots.useQuery({ projectId: project.id, episodeNumber: activeEpisode });
  const shots = data as Shot[];
  const activeShot = shots.find((shot) => shot.id === activeShotId) ?? shots[0];
  const generate = trpc.overseas.generateStoryboardSketch.useMutation({
    onSuccess: () => {
      toast.success("分镜草图已生成");
      refetch();
      utils.overseas.getProject.invalidate({ id: project.id });
    },
    onError: (err) => toast.error(err.message),
  });
  const addVisual = trpc.overseas.addShotVisualToAssetLibrary.useMutation({
    onSuccess: () => toast.success("已加入资产库"),
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => setActiveShotId(null), [activeEpisode]);

  return (
    <div style={{ padding: 18, height: "calc(100vh - 64px)", display: "grid", gridTemplateColumns: "260px minmax(420px, 1fr) 380px", gap: 16 }}>
      <aside style={panel({ padding: 12, overflow: "auto" })}>
        <EpisodeStepper activeEpisode={activeEpisode} maxEpisode={maxEpisode} onChange={onEpisodeChange} />
        <div style={{ height: 12 }} />
        <ShotList shots={shots} activeId={activeShot?.id ?? null} onSelect={setActiveShotId} />
      </aside>
      <section style={panel({ overflow: "hidden", display: "grid", placeItems: "center", background: C.band })}>
        {activeShot?.storyboardSketchUrl ? <img src={activeShot.storyboardSketchUrl} alt="分镜草图" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <ImageIcon size={42} style={{ color: C.dim }} />}
      </section>
      <aside style={panel({ padding: 14, overflow: "auto" })}>
        <h2 style={{ margin: "0 0 12px", fontSize: 16 }}>分镜设计</h2>
        {activeShot ? (
          <div style={{ display: "grid", gap: 11 }}>
            <div style={{ color: C.sub, fontSize: 12, lineHeight: 1.65 }}>{activeShot.visualDescription}</div>
            <Textarea value={activeShot.storyboardPrompt || ""} readOnly rows={8} style={{ ...field(), lineHeight: 1.55 }} />
            <Button disabled={generate.isPending} onClick={() => generate.mutate({ shotId: activeShot.id, imageEngine: "image2", addToAssetLibrary: false })} style={{ background: C.gold, color: C.bg, fontWeight: 900 }}>
              {generate.isPending ? <Loader2 className="animate-spin" size={15} /> : <Wand2 size={15} />} 生成草图
            </Button>
            <Button variant="outline" disabled={!activeShot.storyboardSketchUrl || addVisual.isPending} onClick={() => addVisual.mutate({ shotId: activeShot.id, kind: "storyboard" })} style={{ borderColor: C.line2, color: C.sub }}>
              <Plus size={15} /> 加入资产库
            </Button>
          </div>
        ) : <div style={{ color: C.dim, fontSize: 13 }}>暂无分镜</div>}
      </aside>
    </div>
  );
}

function VideoPanel({ project, activeEpisode, maxEpisode, onEpisodeChange }: {
  project: Project;
  activeEpisode: number;
  maxEpisode: number;
  onEpisodeChange: (episode: number) => void;
}) {
  const utils = trpc.useUtils();
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [activeShotId, setActiveShotId] = useState<number | null>(null);
  const [selectedAssetIds, setSelectedAssetIds] = useState<number[]>([]);
  const [duration, setDuration] = useState(15);
  const { data = [], refetch } = trpc.overseas.listShots.useQuery({ projectId: project.id, episodeNumber: activeEpisode });
  const { data: assetData = [] } = trpc.overseas.listAssets.useQuery({ projectId: project.id });
  const shots = data as Shot[];
  const assets = assetData as Asset[];
  const activeShot = shots.find((shot) => shot.id === activeShotId) ?? shots[0];
  const imageAssets = assets.filter((asset) => !!assetImage(asset));
  const generatePrompt = trpc.overseas.generatePremiumVideoPrompt.useMutation({
    onSuccess: () => {
      toast.success("Seedance 2.0 提示词已生成");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const generateDiagram = trpc.overseas.generateCameraDiagram.useMutation({
    onSuccess: () => {
      toast.success("机位示意图已生成");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const addVisual = trpc.overseas.addShotVisualToAssetLibrary.useMutation({
    onSuccess: () => toast.success("已加入资产库"),
    onError: (err) => toast.error(err.message),
  });
  const generateVideo = trpc.overseas.generatePremiumVideo.useMutation({
    onSuccess: () => {
      toast.success("视频已生成");
      refetch();
      utils.overseas.getProject.invalidate({ id: project.id });
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => setActiveShotId(null), [activeEpisode]);
  useEffect(() => setDuration(activeShot?.videoDuration ?? 15), [activeShot?.id, activeShot?.videoDuration]);

  const refUrls = imageAssets.filter((asset) => selectedAssetIds.includes(asset.id)).map((asset) => assetImage(asset)!).slice(0, 9);

  return (
    <div style={{ padding: 18, height: "calc(100vh - 64px)", display: "grid", gridTemplateColumns: "260px minmax(420px, 1fr) 430px", gap: 16 }}>
      <aside style={panel({ padding: 12, overflow: "auto" })}>
        <EpisodeStepper activeEpisode={activeEpisode} maxEpisode={maxEpisode} onChange={onEpisodeChange} />
        <div style={{ height: 12 }} />
        <ShotList shots={shots} activeId={activeShot?.id ?? null} onSelect={setActiveShotId} />
      </aside>
      <section style={panel({ display: "grid", gridTemplateRows: "1fr 190px", overflow: "hidden" })}>
        <div style={{ background: C.band, display: "grid", placeItems: "center", overflow: "hidden" }}>
          {activeShot?.videoUrl ? <video src={activeShot.videoUrl} controls style={{ width: "100%", height: "100%", objectFit: "contain" }} /> :
            activeShot?.cameraDiagramUrl ? <img src={activeShot.cameraDiagramUrl} alt="机位示意图" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> :
              activeShot?.storyboardSketchUrl ? <img src={activeShot.storyboardSketchUrl} alt="分镜草图" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> :
                <Play size={42} style={{ color: C.dim }} />}
        </div>
        <div style={{ borderTop: `1px solid ${C.line}`, padding: 12, overflow: "auto" }}>
          <div style={{ fontSize: 13, fontWeight: 900 }}>{activeShot ? `镜头 ${activeShot.episodeNumber}.${activeShot.shotNumber}` : "未选择镜头"}</div>
          <div style={{ color: C.sub, fontSize: 12, lineHeight: 1.55, marginTop: 6 }}>{activeShot?.visualDescription || "暂无镜头描述"}</div>
        </div>
      </section>
      <aside style={panel({ padding: 14, overflow: "auto" })}>
        <h2 style={{ margin: "0 0 12px", fontSize: 16 }}>Seedance 2.0</h2>
        {activeShot ? (
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <div style={{ color: C.dim, fontSize: 11, marginBottom: 6 }}>参考图 @{refUrls.length}/9</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                {imageAssets.slice(0, 16).map((asset) => {
                  const checked = selectedAssetIds.includes(asset.id);
                  return (
                    <button key={asset.id} title={asset.name} onClick={() => setSelectedAssetIds((prev) => checked ? prev.filter((id) => id !== asset.id) : [...prev, asset.id].slice(0, 9))} style={{
                      height: 58,
                      borderRadius: 6,
                      overflow: "hidden",
                      padding: 0,
                      border: `2px solid ${checked ? C.gold : C.line}`,
                      background: C.band,
                      cursor: "pointer",
                    }}>
                      <img src={assetImage(asset)!} alt={asset.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </button>
                  );
                })}
              </div>
            </div>
            <Select value={String(duration)} onValueChange={(value) => setDuration(Number(value))}>
              <SelectTrigger style={field()}><SelectValue /></SelectTrigger>
              <SelectContent>
                {[6, 8, 10, 12, 15].map((value) => <SelectItem key={value} value={String(value)}>{value} 秒</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" disabled={generatePrompt.isPending} onClick={() => generatePrompt.mutate({ shotId: activeShot.id, referenceAssetIds: selectedAssetIds, duration })} style={{ borderColor: C.line2, color: C.sub }}>
              {generatePrompt.isPending ? <Loader2 className="animate-spin" size={14} /> : <Wand2 size={14} />} 生成视频提示词
            </Button>
            <Textarea ref={promptRef} key={activeShot.id + (activeShot.videoPrompt || "")} defaultValue={activeShot.videoPrompt || ""} rows={10} style={{ ...field(), lineHeight: 1.6 }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Button variant="outline" disabled={generateDiagram.isPending} onClick={() => generateDiagram.mutate({ shotId: activeShot.id, imageEngine: "image2", addToAssetLibrary: false })} style={{ borderColor: C.line2, color: C.sub }}>
                {generateDiagram.isPending ? <Loader2 className="animate-spin" size={14} /> : <Camera size={14} />} 机位图
              </Button>
              <Button variant="outline" disabled={!activeShot.cameraDiagramUrl || addVisual.isPending} onClick={() => addVisual.mutate({ shotId: activeShot.id, kind: "camera_diagram" })} style={{ borderColor: C.line2, color: C.sub }}>
                <Plus size={14} /> 加资产
              </Button>
            </div>
            <Button disabled={generateVideo.isPending} onClick={() => generateVideo.mutate({ shotId: activeShot.id, prompt: promptRef.current?.value || activeShot.videoPrompt || "", referenceImageUrls: refUrls, duration, aspectRatio: project.aspectRatio === "landscape" ? "16:9" : "9:16" })} style={{ background: C.gold, color: C.bg, fontWeight: 900, height: 42 }}>
              {generateVideo.isPending ? <Loader2 className="animate-spin" size={15} /> : <Play size={15} />} 生成视频
            </Button>
            {activeShot.videoPrompt && (
              <Button variant="outline" onClick={() => navigator.clipboard.writeText(promptRef.current?.value || activeShot.videoPrompt || "")} style={{ borderColor: C.line2, color: C.sub }}>
                <Copy size={14} /> 复制提示词
              </Button>
            )}
          </div>
        ) : <div style={{ color: C.dim, fontSize: 13 }}>暂无镜头</div>}
      </aside>
    </div>
  );
}
