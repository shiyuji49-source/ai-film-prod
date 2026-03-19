// DESIGN: "鎏光机" 导演手册工业风暗色系
// Dashboard — 多项目管理首页
// Colors: bg-base oklch(0.13), accent amber oklch(0.75 0.17 65)
// Font: Space Grotesk headings, JetBrains Mono badges

import { useState, useRef } from "react";
import { useProjectManager } from "@/contexts/ProjectManagerContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Film, Plus, Trash2, Copy, Download, Share2, Upload,
  FolderOpen, Clock, CheckCircle2, ChevronRight, FileJson,
  FileText, Layers, Clapperboard, Coins, LogOut, Shield, ImageIcon, Settings, Globe,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import CreditsShopDialog from "@/components/CreditsShopDialog";
import { ShoppingCart } from "lucide-react";
import { Link } from "wouter";

const PHASE_LABELS: Record<string, string> = {
  phase1: "项目定义",
  phase2: "资产设计",
  phase3: "分镜设计",
  phase4: "提示词",
  phase5: "生成后期",
  phase6: "素材库",
};

const PHASE_ORDER = ["phase1", "phase2", "phase3", "phase4", "phase5", "phase6"];

function getProgress(completedPhases: string[]): number {
  return Math.round((completedPhases.length / PHASE_ORDER.length) * 100);
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

interface DashboardProps {
  onOpenProject: () => void;
}

export default function Dashboard({ onOpenProject }: DashboardProps) {
  const manager = useProjectManager();
  const { user, logout } = useAuth();
  const [search, setSearch] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [showShop, setShowShop] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const filtered = manager.projects.filter(p =>
    (p.projectInfo.title || "未命名项目").toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = () => {
    manager.createProject();
    onOpenProject();
  };

  const handleOpen = (id: string) => {
    manager.switchProject(id);
    onOpenProject();
  };

  const handleDuplicate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    manager.duplicateProject(id);
    toast.success("项目已复制");
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteId(id);
  };

  const confirmDelete = () => {
    if (confirmDeleteId) {
      manager.deleteProject(confirmDeleteId);
      setConfirmDeleteId(null);
      toast.success("项目已删除");
    }
  };

  const handleExportMd = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    manager.exportProjectMarkdown(id);
    toast.success("Markdown 文档已导出");
  };

  const handleExportJson = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    manager.exportProjectJSON(id);
    toast.success("项目文件已导出");
  };

  const handleShare = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const link = manager.getShareLink(id);
    setShareLink(link);
  };

  const handleCopyLink = () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink);
      toast.success("分享链接已复制到剪贴板");
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        manager.importProjectJSON(ev.target?.result as string);
        toast.success("项目已导入");
        onOpenProject();
      } catch {
        toast.error("导入失败，请检查文件格式");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div style={{ minHeight: "100vh", background: "oklch(0.13 0.005 240)", color: "oklch(0.92 0.005 60)", fontFamily: "'Space Grotesk', sans-serif" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid oklch(0.22 0.006 240)", padding: "0 2rem" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, background: "oklch(0.75 0.17 65)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Clapperboard size={20} style={{ color: "oklch(0.1 0.005 240)" }} />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em", color: "oklch(0.92 0.005 60)" }}>鎏光机</div>
              <div style={{ fontSize: 11, color: "oklch(0.55 0.01 240)", fontFamily: "'JetBrains Mono', monospace", marginTop: -2 }}>AI FILM WORKFLOW</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Credits + Shop */}
            {user && (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Link href="/credits">
                  <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: "8px 0 0 8px", background: "oklch(0.18 0.007 240)", border: "1px solid oklch(0.26 0.008 240)", borderRight: "none", fontSize: 12, fontWeight: 700, color: "oklch(0.75 0.17 65)", fontFamily: "'JetBrains Mono', monospace", cursor: "pointer", textDecoration: "none" }}>
                    <Coins size={12} />
                    {user.credits?.toLocaleString() ?? "—"} 积分
                  </div>
                </Link>
                <button
                  onClick={() => setShowShop(true)}
                  style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: "0 8px 8px 0", background: "oklch(0.75 0.17 65 / 0.15)", border: "1px solid oklch(0.75 0.17 65 / 0.4)", fontSize: 11, fontWeight: 600, color: "oklch(0.75 0.17 65)", cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  <ShoppingCart size={11} />
                  购买
                </button>
              </div>
            )}
            {/* User name */}
            {user && (
              <div style={{ fontSize: 12, color: "oklch(0.60 0.01 240)", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user.name || user.identifier}
              </div>
            )}
            <input ref={importRef} type="file" accept=".json" style={{ display: "none" }} onChange={handleImport} />
            <Button variant="outline" size="sm" onClick={() => importRef.current?.click()}
              style={{ borderColor: "oklch(0.28 0.008 240)", color: "oklch(0.65 0.01 240)", background: "transparent", gap: 6 }}>
              <Upload size={14} /> 导入项目
            </Button>
            <Button size="sm" onClick={handleCreate}
              style={{ background: "oklch(0.75 0.17 65)", color: "oklch(0.1 0.005 240)", fontWeight: 600, gap: 6 }}>
              <Plus size={14} /> 新建项目
            </Button>
            <Link href="/assets">
              <Button variant="outline" size="sm"
                style={{ borderColor: "oklch(0.60 0.15 200 / 0.5)", color: "oklch(0.60 0.15 200)", background: "oklch(0.60 0.15 200 / 0.08)", gap: 6 }}>
                <ImageIcon size={14} /> 资产库
              </Button>
            </Link>
            <Link href="/api-settings">
              <Button variant="outline" size="sm"
                style={{ borderColor: "oklch(0.50 0.15 240 / 0.5)", color: "oklch(0.60 0.12 240)", background: "oklch(0.50 0.15 240 / 0.08)", gap: 6 }}>
                <Settings size={14} /> AI 设置
              </Button>
            </Link>
            <Link href="/overseas">
              <Button variant="outline" size="sm"
                style={{ borderColor: "oklch(0.65 0.18 145 / 0.5)", color: "oklch(0.65 0.18 145)", background: "oklch(0.65 0.18 145 / 0.08)", gap: 6 }}>
                <Globe size={14} /> 出海短剧
              </Button>
            </Link>
            {user?.role === "admin" && (
              <Link href="/admin">
                <Button variant="outline" size="sm"
                  style={{ borderColor: "oklch(0.75 0.17 65 / 0.5)", color: "oklch(0.75 0.17 65)", background: "oklch(0.75 0.17 65 / 0.08)", gap: 6 }}>
                  <Shield size={14} /> 管理后台
                </Button>
              </Link>
            )}
            {user && (
              <Button variant="outline" size="sm" onClick={() => logout()}
                style={{ borderColor: "oklch(0.28 0.008 240)", color: "oklch(0.55 0.01 240)", background: "transparent", gap: 6 }}>
                <LogOut size={14} /> 退出
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "2rem" }}>
        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 32 }}>
          {[
            { icon: <Layers size={18} />, label: "全部项目", value: manager.projects.length },
            { icon: <CheckCircle2 size={18} />, label: "已完成", value: manager.projects.filter(p => p.completedPhases.length === 6).length },
            { icon: <Film size={18} />, label: "进行中", value: manager.projects.filter(p => p.completedPhases.length > 0 && p.completedPhases.length < 6).length },
          ].map((stat, i) => (
            <div key={i} style={{ background: "oklch(0.15 0.006 240)", border: "1px solid oklch(0.22 0.006 240)", borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ color: "oklch(0.75 0.17 65)" }}>{stat.icon}</div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: "oklch(0.92 0.005 60)" }}>{stat.value}</div>
                <div style={{ fontSize: 12, color: "oklch(0.55 0.01 240)" }}>{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <Input
            placeholder="搜索项目名称..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ maxWidth: 320, background: "oklch(0.17 0.006 240)", border: "1px solid oklch(0.25 0.008 240)", color: "oklch(0.85 0.005 60)" }}
          />
          <span style={{ fontSize: 13, color: "oklch(0.55 0.01 240)" }}>{filtered.length} 个项目</span>
        </div>

        {/* Project grid */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "oklch(0.45 0.008 240)" }}>
            <Film size={48} style={{ margin: "0 auto 16px", opacity: 0.3 }} />
            <div style={{ fontSize: 16 }}>暂无项目</div>
            <div style={{ fontSize: 13, marginTop: 8 }}>点击「新建项目」开始您的 AI 影片创作</div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
            {filtered.map(project => {
              const progress = getProgress(project.completedPhases);
              const isActive = project.id === manager.activeProjectId;
              const title = project.projectInfo.title || "未命名项目";
              const epCount = project.scriptAnalysis.episodes.length;
              const shotCount = project.shots.length;
              const currentPhase = PHASE_ORDER.find(p => !project.completedPhases.includes(p)) || "phase6";

              return (
                <div
                  key={project.id}
                  onClick={() => handleOpen(project.id)}
                  style={{
                    background: "oklch(0.15 0.006 240)",
                    border: `1px solid ${isActive ? "oklch(0.75 0.17 65 / 0.5)" : "oklch(0.22 0.006 240)"}`,
                    borderRadius: 12,
                    padding: "20px",
                    cursor: "pointer",
                    transition: "border-color 0.2s, transform 0.15s",
                    position: "relative",
                    overflow: "hidden",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = "oklch(0.75 0.17 65 / 0.6)";
                    (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = isActive ? "oklch(0.75 0.17 65 / 0.5)" : "oklch(0.22 0.006 240)";
                    (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
                  }}
                >
                  {/* Active badge */}
                  {isActive && (
                    <div style={{ position: "absolute", top: 12, right: 12, background: "oklch(0.75 0.17 65 / 0.2)", border: "1px solid oklch(0.75 0.17 65 / 0.4)", borderRadius: 6, padding: "2px 8px", fontSize: 11, color: "oklch(0.75 0.17 65)", fontFamily: "'JetBrains Mono', monospace" }}>
                      当前
                    </div>
                  )}

                  {/* Title */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 40, height: 40, background: "oklch(0.75 0.17 65 / 0.12)", border: "1px solid oklch(0.75 0.17 65 / 0.25)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Film size={18} style={{ color: "oklch(0.75 0.17 65)" }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "oklch(0.92 0.005 60)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
                      <div style={{ fontSize: 12, color: "oklch(0.55 0.01 240)", marginTop: 2 }}>
                        {project.projectInfo.type || "未设定类型"} · {project.projectInfo.platform || "未设定平台"}
                      </div>
                    </div>
                  </div>

                  {/* Stats chips */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                    {[
                      { icon: <Layers size={11} />, label: `${epCount} 集` },
                      { icon: <Clapperboard size={11} />, label: `${shotCount} 镜头` },
                      { icon: <Clock size={11} />, label: formatDate(project.updatedAt) },
                    ].map((chip, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, background: "oklch(0.20 0.006 240)", borderRadius: 6, padding: "3px 8px", fontSize: 11, color: "oklch(0.65 0.01 240)", fontFamily: "'JetBrains Mono', monospace" }}>
                        {chip.icon}{chip.label}
                      </div>
                    ))}
                  </div>

                  {/* Progress bar */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: "oklch(0.55 0.01 240)" }}>当前：{PHASE_LABELS[currentPhase]}</span>
                      <span style={{ fontSize: 11, color: "oklch(0.75 0.17 65)", fontFamily: "'JetBrains Mono', monospace" }}>{progress}%</span>
                    </div>
                    <div style={{ height: 4, background: "oklch(0.22 0.006 240)", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${progress}%`, background: "oklch(0.75 0.17 65)", borderRadius: 4, transition: "width 0.5s ease" }} />
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: "flex", gap: 6, justifyContent: "space-between" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={e => handleDuplicate(project.id, e)} title="复制项目"
                        style={{ background: "oklch(0.20 0.006 240)", border: "1px solid oklch(0.25 0.008 240)", borderRadius: 6, padding: "5px 8px", color: "oklch(0.65 0.01 240)", cursor: "pointer", display: "flex", alignItems: "center" }}>
                        <Copy size={13} />
                      </button>
                      <button onClick={e => handleExportMd(project.id, e)} title="导出 Markdown"
                        style={{ background: "oklch(0.20 0.006 240)", border: "1px solid oklch(0.25 0.008 240)", borderRadius: 6, padding: "5px 8px", color: "oklch(0.65 0.01 240)", cursor: "pointer", display: "flex", alignItems: "center" }}>
                        <FileText size={13} />
                      </button>
                      <button onClick={e => handleExportJson(project.id, e)} title="导出 JSON"
                        style={{ background: "oklch(0.20 0.006 240)", border: "1px solid oklch(0.25 0.008 240)", borderRadius: 6, padding: "5px 8px", color: "oklch(0.65 0.01 240)", cursor: "pointer", display: "flex", alignItems: "center" }}>
                        <FileJson size={13} />
                      </button>
                      <button onClick={e => handleShare(project.id, e)} title="生成分享链接"
                        style={{ background: "oklch(0.20 0.006 240)", border: "1px solid oklch(0.25 0.008 240)", borderRadius: 6, padding: "5px 8px", color: "oklch(0.65 0.01 240)", cursor: "pointer", display: "flex", alignItems: "center" }}>
                        <Share2 size={13} />
                      </button>
                      <button onClick={e => handleDelete(project.id, e)} title="删除项目"
                        style={{ background: "oklch(0.20 0.006 240)", border: "1px solid oklch(0.25 0.008 240)", borderRadius: 6, padding: "5px 8px", color: "oklch(0.55 0.2 25)", cursor: "pointer", display: "flex", alignItems: "center" }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <button onClick={() => handleOpen(project.id)}
                      style={{ background: "oklch(0.75 0.17 65 / 0.12)", border: "1px solid oklch(0.75 0.17 65 / 0.3)", borderRadius: 6, padding: "5px 12px", color: "oklch(0.75 0.17 65)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600 }}>
                      打开 <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete confirm modal */}
      {confirmDeleteId && (
        <div style={{ position: "fixed", inset: 0, background: "oklch(0 0 0 / 0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "oklch(0.17 0.006 240)", border: "1px solid oklch(0.28 0.008 240)", borderRadius: 16, padding: 28, maxWidth: 360, width: "90%" }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>确认删除项目？</div>
            <div style={{ fontSize: 13, color: "oklch(0.65 0.01 240)", marginBottom: 20 }}>此操作不可撤销，项目所有数据将被永久删除。</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Button variant="outline" size="sm" onClick={() => setConfirmDeleteId(null)}
                style={{ borderColor: "oklch(0.28 0.008 240)", color: "oklch(0.65 0.01 240)", background: "transparent" }}>取消</Button>
              <Button size="sm" onClick={confirmDelete}
                style={{ background: "oklch(0.55 0.2 25)", color: "white" }}>确认删除</Button>
            </div>
          </div>
        </div>
      )}

      {/* Credits Shop Dialog */}
      <CreditsShopDialog open={showShop} onClose={() => setShowShop(false)} />

      {/* Share link modal */}
      {shareLink && (
        <div style={{ position: "fixed", inset: 0, background: "oklch(0 0 0 / 0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "oklch(0.17 0.006 240)", border: "1px solid oklch(0.28 0.008 240)", borderRadius: 16, padding: 28, maxWidth: 520, width: "90%" }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <Share2 size={16} style={{ color: "oklch(0.75 0.17 65)" }} /> 分享项目
            </div>
            <div style={{ fontSize: 13, color: "oklch(0.65 0.01 240)", marginBottom: 12 }}>
              将以下链接发送给协作者，他们可以直接导入您的项目数据。
            </div>
            <div style={{ background: "oklch(0.13 0.005 240)", border: "1px solid oklch(0.25 0.008 240)", borderRadius: 8, padding: "10px 12px", fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "oklch(0.75 0.005 60)", wordBreak: "break-all", marginBottom: 16, maxHeight: 80, overflow: "auto" }}>
              {shareLink}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Button variant="outline" size="sm" onClick={() => setShareLink(null)}
                style={{ borderColor: "oklch(0.28 0.008 240)", color: "oklch(0.65 0.01 240)", background: "transparent" }}>关闭</Button>
              <Button size="sm" onClick={handleCopyLink}
                style={{ background: "oklch(0.75 0.17 65)", color: "oklch(0.1 0.005 240)", fontWeight: 600, gap: 6 }}>
                <Copy size={13} /> 复制链接
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
