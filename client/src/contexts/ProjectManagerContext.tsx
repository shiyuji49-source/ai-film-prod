// DESIGN: "鎏光机" 导演手册工业风暗色系 — Multi-Project Manager Context
// 已登录用户：项目数据同步到数据库（每账号独立）
// 未登录用户：项目数据存在 localStorage（兼容旧版）

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import type {
  ProjectInfo, ScriptAnalysis, Character, EpisodeAsset, Shot, VideoSegment,
} from "./ProjectContext";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProjectSnapshot {
  id: string;
  createdAt: number;
  updatedAt: number;
  projectInfo: ProjectInfo;
  scriptText: string;
  scriptAnalysis: ScriptAnalysis;
  characters: Character[];
  episodeAssets: EpisodeAsset[];
  shots: Shot[];
  videoSegments: VideoSegment[];
  activePhase: string;
  completedPhases: string[];  // serialized Set
}

interface ProjectManagerContextType {
  projects: ProjectSnapshot[];
  activeProjectId: string | null;
  isCloudMode: boolean;
  isSyncing: boolean;

  createProject: () => string;
  duplicateProject: (id: string) => string;
  deleteProject: (id: string) => void;
  switchProject: (id: string) => void;
  updateProjectSnapshot: (snapshot: Partial<ProjectSnapshot>) => void;
  exportProjectMarkdown: (id: string) => void;
  exportProjectJSON: (id: string) => void;
  importProjectJSON: (json: string) => void;
  getShareLink: (id: string) => string;
  importFromShareLink: (hash: string) => void;
}

// ─── Storage ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = "liuguangji_projects_v1";
const ACTIVE_KEY = "liuguangji_active_project_v1";

function nanoid() {
  return Math.random().toString(36).slice(2, 9);
}

function defaultProjectInfo(): ProjectInfo {
  return {
    title: "", type: "", episodes: "", platform: "", ratio: "9:16 竖屏",
    audience: "", selling: "", styleZh: "", styleEn: "",
    styleCategory: "", styleSubtype: "",
    market: "中国", orientation: "portrait",
  };
}

function defaultScriptAnalysis(): ScriptAnalysis {
  return { episodes: [], globalCharacters: [], isAnalyzed: false };
}

function migrateSnapshot(raw: Record<string, unknown>): ProjectSnapshot {
  const defaultInfo = defaultProjectInfo();
  const rawInfo = (raw.projectInfo as Record<string, unknown>) || {};
  const projectInfo: ProjectInfo = {
    title: (rawInfo.title as string) ?? defaultInfo.title,
    type: (rawInfo.type as string) ?? defaultInfo.type,
    episodes: (rawInfo.episodes as string) ?? defaultInfo.episodes,
    platform: (rawInfo.platform as string) ?? defaultInfo.platform,
    ratio: (rawInfo.ratio as string) ?? defaultInfo.ratio,
    audience: (rawInfo.audience as string) ?? defaultInfo.audience,
    selling: (rawInfo.selling as string) ?? defaultInfo.selling,
    styleZh: (rawInfo.styleZh as string) ?? defaultInfo.styleZh,
    styleEn: (rawInfo.styleEn as string) ?? defaultInfo.styleEn,
    styleCategory: (rawInfo.styleCategory as string) ?? defaultInfo.styleCategory,
    styleSubtype: (rawInfo.styleSubtype as string) ?? defaultInfo.styleSubtype,
    market: (rawInfo.market as string) ?? defaultInfo.market,
    orientation: (rawInfo.orientation as string) ?? defaultInfo.orientation,
  };
  const characters = ((raw.characters as Record<string, unknown>[]) || []).map(c => ({
    id: (c.id as string) || "",
    name: (c.name as string) || "",
    role: (c.role as string) || "",
    appearance: (c.appearance as string) || "",
    costume: (c.costume as string) || "",
    marks: (c.marks as string) || "",
    isMecha: typeof c.isMecha === "boolean" ? c.isMecha : false,
    promptZh: (c.promptZh as string) || "",
    promptEn: (c.promptEn as string) || "",
    // 图片 URL 字段 — 必须保留，否则刷新后资产图片丢失
    ...(c.uploadedImageUrl ? { uploadedImageUrl: c.uploadedImageUrl as string } : {}),
    ...(c.designImageUrl ? { designImageUrl: c.designImageUrl as string } : {}),
    ...(c.mainImageUrl ? { mainImageUrl: c.mainImageUrl as string } : {}),
    ...(c.closeupImageUrl ? { closeupImageUrl: c.closeupImageUrl as string } : {}),
    ...(c.frontImageUrl ? { frontImageUrl: c.frontImageUrl as string } : {}),
    ...(c.sideImageUrl ? { sideImageUrl: c.sideImageUrl as string } : {}),
    ...(c.backImageUrl ? { backImageUrl: c.backImageUrl as string } : {}),
    ...(c.assetLibId ? { assetLibId: c.assetLibId as number } : {}),
    // Q版形象字段
    ...(typeof c.isQVersion === "boolean" ? { isQVersion: c.isQVersion } : {}),
    ...(c.qVersionPromptZh ? { qVersionPromptZh: c.qVersionPromptZh as string } : {}),
    ...(c.qVersionPromptEn ? { qVersionPromptEn: c.qVersionPromptEn as string } : {}),
  }));
  return {
    id: (raw.id as string) || "",
    createdAt: (raw.createdAt as number) || Date.now(),
    updatedAt: (raw.updatedAt as number) || Date.now(),
    projectInfo,
    scriptText: (raw.scriptText as string) || "",
    scriptAnalysis: (raw.scriptAnalysis as ScriptAnalysis) || defaultScriptAnalysis(),
    characters,
    episodeAssets: (raw.episodeAssets as EpisodeAsset[]) || [],
    shots: (raw.shots as Shot[]) || [],
    videoSegments: (raw.videoSegments as VideoSegment[]) || [],
    activePhase: (raw.activePhase as string) || "phase1",
    completedPhases: (raw.completedPhases as string[]) || [],
  };
}

function loadLocalProjects(): ProjectSnapshot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Record<string, unknown>[];
    return parsed.map(migrateSnapshot);
  } catch {
    return [];
  }
}

function saveLocalProjects(projects: ProjectSnapshot[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch {
    // quota exceeded — silently ignore
  }
}

function newSnapshot(overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  const now = Date.now();
  return {
    id: nanoid(),
    createdAt: now,
    updatedAt: now,
    projectInfo: defaultProjectInfo(),
    scriptText: "",
    scriptAnalysis: defaultScriptAnalysis(),
    characters: [],
    episodeAssets: [],
    shots: [],
    videoSegments: [],
    activePhase: "phase1",
    completedPhases: [],
    ...overrides,
  };
}

// ─── Export helpers ───────────────────────────────────────────────────────────

function buildMarkdown(p: ProjectSnapshot): string {
  const { projectInfo: info, scriptAnalysis, characters, shots, videoSegments } = p;
  const lines: string[] = [];

  lines.push(`# ${info.title || "未命名项目"} — 制作文档`);
  lines.push(`> 由鎏光机 AI 影片工作流工具导出 · ${new Date(p.updatedAt).toLocaleString("zh-CN")}`);
  lines.push("");

  lines.push("## 项目基础信息");
  lines.push(`| 字段 | 内容 |`);
  lines.push(`|------|------|`);
  lines.push(`| 类型 | ${info.type || "-"} |`);
  lines.push(`| 平台 | ${info.platform || "-"} |`);
  lines.push(`| 画面比例 | ${info.ratio || "-"} |`);
  lines.push(`| 目标受众 | ${info.audience || "-"} |`);
  lines.push(`| 核心卖点 | ${info.selling || "-"} |`);
  lines.push(`| 视觉风格 | ${info.styleZh || "-"} |`);
  lines.push("");

  if (characters.length > 0) {
    lines.push("## 角色档案");
    characters.forEach(c => {
      lines.push(`### ${c.name} (${c.role || "未定义"})`);
      lines.push(`- **外貌**: ${c.appearance || "-"}`);
      lines.push(`- **服装**: ${c.costume || "-"}`);
      lines.push(`- **特殊标记**: ${c.marks || "-"}`);
      if (c.promptZh) {
        lines.push("");
        lines.push("**MJ 提示词 (中文)**");
        lines.push("```");
        lines.push(c.promptZh);
        lines.push("```");
      }
      if (c.promptEn) {
        lines.push("");
        lines.push("**MJ Prompt (English)**");
        lines.push("```");
        lines.push(c.promptEn);
        lines.push("```");
      }
      lines.push("");
    });
  }

  if (scriptAnalysis.episodes.length > 0) {
    lines.push("## 分集概要");
    scriptAnalysis.episodes.forEach(ep => {
      lines.push(`### 第 ${ep.number} 集 — ${ep.title}`);
      lines.push(`- **时长**: 约 ${ep.duration} 分钟`);
      lines.push(`- **简介**: ${ep.synopsis}`);
      lines.push(`- **主要场景**: ${ep.scenes.join("、")}`);
      lines.push(`- **关键道具**: ${ep.props.join("、") || "-"}`);
      lines.push(`- **出场角色**: ${ep.characters.join("、") || "-"}`);
      lines.push("");

      const epShots = shots.filter(s => s.episodeId === ep.id);
      if (epShots.length > 0) {
        lines.push("#### 分镜表");
        lines.push("| # | 类型 | 景别 | 运动 | 描述 | 时长 | 情绪 | VO | SFX |");
        lines.push("|---|------|------|------|------|------|------|----|----|");
        epShots.forEach(s => {
          lines.push(`| ${s.number} | ${s.type} | ${s.size} | ${s.movement} | ${s.description} | ${s.duration}s | ${s.emotion} | ${s.vo || "-"} | ${s.sfx || "-"} |`);
        });
        lines.push("");
      }

      const epSegs = videoSegments.filter(s => s.episodeId === ep.id);
      if (epSegs.length > 0) {
        lines.push("#### Seedance 提示词");
        epSegs.forEach((seg, i) => {
          lines.push(`**片段 ${i + 1} — ${seg.name}** (${seg.duration}s)`);
          lines.push("```");
          lines.push(seg.prompt || "[未生成]");
          lines.push("```");
          lines.push("");
        });
      }
    });
  }

  return lines.join("\n");
}

function downloadText(content: string, filename: string, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ProjectManagerContext = createContext<ProjectManagerContextType | null>(null);

export function ProjectManagerProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const isCloudMode = isAuthenticated && !!user;

  // ── Local state ──────────────────────────────────────────────────────────────
  const [projects, setProjects] = useState<ProjectSnapshot[]>(() => {
    const loaded = loadLocalProjects();
    return loaded.length > 0 ? loaded : [newSnapshot({ projectInfo: { ...defaultProjectInfo(), title: "我的第一个项目" } })];
  });

  const [activeProjectId, setActiveProjectId] = useState<string | null>(() => {
    const saved = localStorage.getItem(ACTIVE_KEY);
    const loaded = loadLocalProjects();
    if (saved && loaded.some(p => p.id === saved)) return saved;
    return loaded.length > 0 ? loaded[0].id : null;
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── tRPC mutations ────────────────────────────────────────────────────────────
  const saveProjectMutation = trpc.projects.save.useMutation();
  const deleteProjectMutation = trpc.projects.delete.useMutation();
  const utils = trpc.useUtils();

  // ── Cloud: load projects on login ────────────────────────────────────────────
  const { data: cloudProjects, isLoading: cloudLoading } = trpc.projects.list.useQuery(undefined, {
    enabled: isCloudMode,
    refetchOnWindowFocus: false,
  });

  // When cloud projects load, replace local state
  const cloudLoadedRef = useRef(false);
  useEffect(() => {
    if (!isCloudMode || cloudLoading || cloudLoadedRef.current) return;
    if (!cloudProjects) return;

    // Cloud projects are just metadata (no data field yet). We need to fetch full data lazily.
    // For now, set project list from cloud metadata, data will be loaded on switch.
    if (cloudProjects.length > 0) {
      // We'll keep local snapshots for projects that exist in cloud (matched by clientId)
      // and add any cloud-only projects as stubs
      setProjects(prev => {
        const localMap = new Map(prev.map(p => [p.id, p]));
        const merged: ProjectSnapshot[] = cloudProjects.map(cp => {
          const local = localMap.get(cp.clientId);
          if (local) return { ...local, updatedAt: cp.lastActiveAt.getTime() };
          // Cloud-only project: create stub
          return newSnapshot({
            id: cp.clientId,
            createdAt: cp.createdAt.getTime(),
            updatedAt: cp.lastActiveAt.getTime(),
            projectInfo: { ...defaultProjectInfo(), title: cp.name },
          });
        });
        return merged;
      });
      const firstId = cloudProjects[0].clientId;
      setActiveProjectId(prev => {
        if (prev && cloudProjects.some(cp => cp.clientId === prev)) return prev;
        return firstId;
      });
    }
    cloudLoadedRef.current = true;
  }, [isCloudMode, cloudLoading, cloudProjects]);

  // Reset cloud loaded flag on logout
  useEffect(() => {
    if (!isAuthenticated) {
      cloudLoadedRef.current = false;
    }
  }, [isAuthenticated]);

  // Extra guard: once cloudProjects loads, if activeProjectId is stale, switch immediately
  useEffect(() => {
    if (!isCloudMode || cloudLoading || !cloudProjects) return;
    if (!activeProjectId) return;
    const isValid = cloudProjects.some(cp => cp.clientId === activeProjectId);
    if (!isValid && cloudProjects.length > 0) {
      setActiveProjectId(cloudProjects[0].clientId);
    } else if (!isValid && cloudProjects.length === 0) {
      setActiveProjectId(null);
    }
  }, [cloudProjects, cloudLoading, isCloudMode, activeProjectId]);

  // ── Cloud: load full project data when switching ──────────────────────────────
  // IMPORTANT: Only enable AFTER cloudProjects has loaded and the ID is confirmed valid.
  // This prevents querying with a stale localStorage ID before the server list is available,
  // which was causing the "项目不存在" error on every page load.
  const isActiveIdValidInCloud = !cloudLoading && !!cloudProjects && cloudProjects.some(cp => cp.clientId === activeProjectId);
  const { data: activeCloudProject, error: activeCloudProjectError } = trpc.projects.get.useQuery(
    { clientId: activeProjectId! },
    {
      enabled: isCloudMode && !!activeProjectId && isActiveIdValidInCloud,
      refetchOnWindowFocus: false,
      retry: false,
    }
  );

  // Fallback: if somehow an error still occurs (e.g. race condition), switch to first valid project
  useEffect(() => {
    if (!activeCloudProjectError) return;
    const isNotFound = (activeCloudProjectError as { data?: { code?: string } })?.data?.code === 'NOT_FOUND';
    if (isNotFound && cloudProjects && cloudProjects.length > 0) {
      const firstValidId = cloudProjects[0].clientId;
      setActiveProjectId(firstValidId);
      setProjects(prev => prev.filter(p => cloudProjects.some(cp => cp.clientId === p.id)));
    }
  }, [activeCloudProjectError, cloudProjects]);

  useEffect(() => {
    if (!isCloudMode || !activeCloudProject) return;
    try {
      const parsed = JSON.parse(activeCloudProject.data) as Record<string, unknown>;
      const snap = migrateSnapshot(parsed);
      setProjects(prev => prev.map(p =>
        p.id === activeProjectId ? { ...snap, id: activeProjectId! } : p
      ));
    } catch {
      // invalid JSON in cloud — ignore
    }
  }, [activeCloudProject, activeProjectId, isCloudMode]);

  // ── Auto-save to localStorage (always) ────────────────────────────────────────
  // Always persist to localStorage as an instant local cache.
  // In cloud mode this acts as a safety net: if the user refreshes before the
  // 2-second cloud-sync debounce fires, data is still recoverable from localStorage.
  useEffect(() => {
    saveLocalProjects(projects);
  }, [projects]);

  useEffect(() => {
    if (activeProjectId) localStorage.setItem(ACTIVE_KEY, activeProjectId);
  }, [activeProjectId]);

  // ── Cloud sync helper (debounced) ─────────────────────────────────────────────
  const syncToCloud = useCallback((snapshot: ProjectSnapshot) => {
    if (!isCloudMode) return;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(async () => {
      setIsSyncing(true);
      try {
        await saveProjectMutation.mutateAsync({
          clientId: snapshot.id,
          name: snapshot.projectInfo.title || "未命名项目",
          data: JSON.stringify(snapshot),
        });
        await utils.projects.list.invalidate();
      } catch (err) {
        console.warn("[Cloud sync] Failed:", err);
      } finally {
        setIsSyncing(false);
      }
    }, 2000); // 2s debounce
  }, [isCloudMode, saveProjectMutation, utils]);

  // ── Project operations ────────────────────────────────────────────────────────

  const createProject = useCallback(() => {
    const snap = newSnapshot();
    setProjects(prev => [snap, ...prev]);
    setActiveProjectId(snap.id);
    if (isCloudMode) {
      saveProjectMutation.mutate({
        clientId: snap.id,
        name: "未命名项目",
        data: JSON.stringify(snap),
      });
    }
    return snap.id;
  }, [isCloudMode, saveProjectMutation]);

  const duplicateProject = useCallback((id: string) => {
    setProjects(prev => {
      const src = prev.find(p => p.id === id);
      if (!src) return prev;
      const copy = newSnapshot({
        ...src,
        id: nanoid(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        projectInfo: { ...src.projectInfo, title: `${src.projectInfo.title || "项目"} (副本)` },
      });
      setActiveProjectId(copy.id);
      if (isCloudMode) {
        saveProjectMutation.mutate({
          clientId: copy.id,
          name: copy.projectInfo.title,
          data: JSON.stringify(copy),
        });
      }
      return [copy, ...prev];
    });
    return "";
  }, [isCloudMode, saveProjectMutation]);

  const deleteProject = useCallback((id: string) => {
    setProjects(prev => {
      const next = prev.filter(p => p.id !== id);
      if (next.length === 0) {
        const fresh = newSnapshot();
        setActiveProjectId(fresh.id);
        return [fresh];
      }
      setActiveProjectId(curr => {
        if (curr === id) return next[0].id;
        return curr;
      });
      return next;
    });
    if (isCloudMode) {
      deleteProjectMutation.mutate({ clientId: id });
    }
  }, [isCloudMode, deleteProjectMutation]);

  const switchProject = useCallback((id: string) => {
    setActiveProjectId(id);
  }, []);

  const updateProjectSnapshot = useCallback((snapshot: Partial<ProjectSnapshot>) => {
    setProjects(prev => {
      const updated = prev.map(p => {
        if (p.id !== activeProjectId) return p;
        const merged = { ...p, ...snapshot, updatedAt: Date.now() };
        syncToCloud(merged);
        return merged;
      });
      return updated;
    });
  }, [activeProjectId, syncToCloud]);

  const exportProjectMarkdown = useCallback((id: string) => {
    const p = projects.find(proj => proj.id === id);
    if (!p) return;
    const md = buildMarkdown(p);
    const name = (p.projectInfo.title || "项目").replace(/[/\\?%*:|"<>]/g, "_");
    downloadText(md, `${name}_制作文档.md`);
  }, [projects]);

  const exportProjectJSON = useCallback((id: string) => {
    const p = projects.find(proj => proj.id === id);
    if (!p) return;
    const json = JSON.stringify(p, null, 2);
    const name = (p.projectInfo.title || "项目").replace(/[/\\?%*:|"<>]/g, "_");
    downloadText(json, `${name}_项目文件.json`, "application/json");
  }, [projects]);

  const importProjectJSON = useCallback((json: string) => {
    try {
      const data = JSON.parse(json) as ProjectSnapshot;
      const snap = newSnapshot({ ...data, id: nanoid(), updatedAt: Date.now() });
      setProjects(prev => [snap, ...prev]);
      setActiveProjectId(snap.id);
      if (isCloudMode) {
        saveProjectMutation.mutate({
          clientId: snap.id,
          name: snap.projectInfo.title || "导入项目",
          data: JSON.stringify(snap),
        });
      }
    } catch {
      // invalid JSON — caller should show error
    }
  }, [isCloudMode, saveProjectMutation]);

  const getShareLink = useCallback((id: string) => {
    const p = projects.find(proj => proj.id === id);
    if (!p) return "";
    const encoded = btoa(encodeURIComponent(JSON.stringify(p)));
    return `${window.location.origin}/#share=${encoded}`;
  }, [projects]);

  const importFromShareLink = useCallback((hash: string) => {
    try {
      const encoded = hash.replace(/^#?share=/, "");
      const json = decodeURIComponent(atob(encoded));
      const data = JSON.parse(json) as ProjectSnapshot;
      const snap = newSnapshot({ ...data, id: nanoid(), updatedAt: Date.now() });
      setProjects(prev => [snap, ...prev]);
      setActiveProjectId(snap.id);
    } catch {
      // invalid share link
    }
  }, []);

  return (
    <ProjectManagerContext.Provider value={{
      projects, activeProjectId, isCloudMode, isSyncing,
      createProject, duplicateProject, deleteProject, switchProject,
      updateProjectSnapshot, exportProjectMarkdown, exportProjectJSON,
      importProjectJSON, getShareLink, importFromShareLink,
    }}>
      {children}
    </ProjectManagerContext.Provider>
  );
}

export function useProjectManager() {
  const ctx = useContext(ProjectManagerContext);
  if (!ctx) throw new Error("useProjectManager must be used within ProjectManagerProvider");
  return ctx;
}
