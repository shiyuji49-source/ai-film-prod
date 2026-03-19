// DESIGN: "鎏光机" 导演手册工业风暗色系
// Main layout: Landing → Auth → Dashboard (project list) ↔ Workflow (6-phase editor)
import { motion, AnimatePresence } from "framer-motion";
import Sidebar from "@/components/Sidebar";
import { useProject } from "@/contexts/ProjectContext";
import { useProjectManager } from "@/contexts/ProjectManagerContext";
import Phase1 from "./phases/Phase1";
import Phase2 from "./phases/Phase2";
import Phase3 from "./phases/Phase3";
import Phase4 from "./phases/Phase4";
import Phase5 from "./phases/Phase5";
import Phase6 from "./phases/Phase6";
import Dashboard from "./Dashboard";
import Landing from "./Landing";
import AuthPage from "./AuthPage";
import { useState, useEffect } from "react";
import { Menu, Clapperboard, Coins, LogOut, ChevronDown } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

const HERO_BG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663381754893/9BgyFdoC3HjLKXJmyAaqgB/hero-bg-aFre9kdGFYSWzCA6sTB4wa.webp";

const PHASE_MAP: Record<string, React.ReactNode> = {
  phase1: <Phase1 />,
  phase2: <Phase2 />,
  phase3: <Phase3 />,
  phase4: <Phase4 />,
  phase5: <Phase5 />,
  phase6: <Phase6 />,
};

export default function Home() {
  const { activePhase } = useProject();
  const { activeProjectId } = useProjectManager();
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [view, setView] = useState<"landing" | "auth" | "dashboard" | "workflow">("landing");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const utils = trpc.useUtils();

  // Check URL hash for share link on mount
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith("#share=")) {
      setView("workflow");
    }
  }, []);

  // When active project changes, stay in workflow
  useEffect(() => {
    if (view === "workflow") {
      // stay in workflow when switching projects
    }
  }, [activeProjectId]);

  const handleEnterFromLanding = () => {
    if (isAuthenticated) {
      setView("dashboard");
    } else {
      setView("auth");
    }
  };

  const handleAuthSuccess = () => {
    utils.auth.me.invalidate();
    setView("dashboard");
  };

  const handleLogout = async () => {
    await logout();
    setView("landing");
    toast.success("已退出登录");
  };

  if (loading && view === "landing") {
    // Still loading auth state — show landing while waiting
  }

  const handleEnterOverseas = () => {
    window.location.href = "/overseas";
  };

  if (view === "landing") {
    return <Landing onEnter={handleEnterFromLanding} onEnterOverseas={handleEnterOverseas} />;
  }

  if (view === "auth") {
    return <AuthPage onSuccess={handleAuthSuccess} />;
  }

  if (view === "dashboard") {
    return <Dashboard onOpenProject={() => setView("workflow")} />;
  }

  // ── Workflow view ──────────────────────────────────────────────────────────
  const GOLD = "oklch(0.75 0.17 65)";
  const BG_DARK = "oklch(0.13 0.005 240)";
  const BORDER = "oklch(0.25 0.008 240)";

  return (
    <div className="min-h-screen flex" style={{ background: BG_DARK }}>
      {/* Desktop sidebar */}
      <div className="hidden lg:block w-64 flex-shrink-0">
        <Sidebar onBackToDashboard={() => setView("dashboard")} />
      </div>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-30 lg:hidden"
              style={{ background: "oklch(0 0 0 / 0.6)" }}
              onClick={() => setSidebarOpen(false)}
            />
            <motion.div
              initial={{ x: -256 }}
              animate={{ x: 0 }}
              exit={{ x: -256 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed left-0 top-0 z-40 lg:hidden"
            >
              <Sidebar onBackToDashboard={() => { setSidebarOpen(false); setView("dashboard"); }} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b"
          style={{ background: "oklch(0.15 0.006 240)", borderColor: BORDER }}>
          {/* Left: mobile menu + logo */}
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-1.5 rounded"
              style={{ color: "oklch(0.70 0.008 240)" }}>
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Clapperboard size={16} style={{ color: GOLD }} />
              <span className="text-sm font-bold" style={{ color: "oklch(0.88 0.005 60)", fontFamily: "'Space Grotesk', sans-serif" }}>
                鎏光机
              </span>
            </div>
          </div>

          {/* Right: credits + user menu */}
          <div className="flex items-center gap-3">
            {user && (
              <>
                {/* Credits badge */}
                <div
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
                  style={{ background: "oklch(0.20 0.008 240)", border: `1px solid oklch(0.28 0.008 240)`, color: GOLD, fontFamily: "'JetBrains Mono', monospace" }}
                >
                  <Coins size={12} />
                  <span>{user.credits?.toLocaleString() ?? "—"}</span>
                </div>

                {/* User menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors"
                    style={{ background: "oklch(0.18 0.006 240)", border: `1px solid oklch(0.26 0.008 240)`, color: "oklch(0.75 0.008 240)" }}
                  >
                    <span className="max-w-[80px] truncate">{user.name || user.identifier}</span>
                    <ChevronDown size={11} />
                  </button>

                  <AnimatePresence>
                    {showUserMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-1 rounded-lg py-1 z-50 min-w-[140px]"
                        style={{ background: "oklch(0.17 0.006 240)", border: `1px solid ${BORDER}` }}
                      >
                        <div className="px-3 py-2 border-b" style={{ borderColor: BORDER }}>
                          <div className="text-xs font-medium truncate" style={{ color: "oklch(0.80 0.005 60)" }}>
                            {user.name || "用户"}
                          </div>
                          <div className="text-[10px] truncate mt-0.5" style={{ color: "oklch(0.50 0.01 240)", fontFamily: "'JetBrains Mono', monospace" }}>
                            {user.identifier}
                          </div>
                        </div>
                        <button
                          onClick={() => { setShowUserMenu(false); handleLogout(); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors"
                          style={{ color: "oklch(0.65 0.01 240)" }}
                          onMouseEnter={e => (e.currentTarget.style.color = "oklch(0.80 0.005 60)")}
                          onMouseLeave={e => (e.currentTarget.style.color = "oklch(0.65 0.01 240)")}
                        >
                          <LogOut size={12} />
                          退出登录
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Hero section (only on phase1) */}
        {activePhase === "phase1" && (
          <div className="relative overflow-hidden" style={{ height: "200px" }}>
            <img src={HERO_BG} alt="Film production" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: "linear-gradient(to right, oklch(0.13 0.005 240 / 0.95) 0%, oklch(0.13 0.005 240 / 0.75) 60%, oklch(0.13 0.005 240 / 0.4) 100%)" }} />
            <div className="relative z-10 h-full flex flex-col justify-center px-8 lg:px-10">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-px w-8" style={{ background: GOLD }} />
                <span className="text-xs tracking-widest uppercase" style={{ color: GOLD, fontFamily: "'JetBrains Mono', monospace" }}>
                  AI Film Workflow Tool
                </span>
              </div>
              <h1 className="text-3xl lg:text-4xl font-bold leading-tight mb-2"
                style={{ color: "oklch(0.95 0.005 60)", fontFamily: "'Space Grotesk', sans-serif" }}>
                鎏光机<br />
                <span className="text-xl font-medium" style={{ color: GOLD }}>AI 影片工作流工具</span>
              </h1>
              <p className="text-sm max-w-md" style={{ color: "oklch(0.70 0.008 240)" }}>
                MJ → Gemini 3 Pro Image → 即梦 Seedance 1.5 Pro · 六阶段全流程引导
              </p>
            </div>
          </div>
        )}

        {/* Phase content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 lg:px-8 py-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={activePhase}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                {PHASE_MAP[activePhase]}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-3 border-t flex items-center justify-between"
          style={{ borderColor: "oklch(0.22 0.006 240)", background: "oklch(0.12 0.005 240)" }}>
          <span className="text-[10px] tracking-widest uppercase" style={{ color: "oklch(0.35 0.008 240)", fontFamily: "'JetBrains Mono', monospace" }}>
            鎏光机 AI 影片工作流工具
          </span>
          <span className="text-[10px]" style={{ color: "oklch(0.35 0.008 240)", fontFamily: "'JetBrains Mono', monospace" }}>
            MJ → Gemini 3 Pro Image → Seedance 1.5 Pro
          </span>
        </div>
      </div>

      {/* Close user menu on outside click */}
      {showUserMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
      )}
    </div>
  );
}
