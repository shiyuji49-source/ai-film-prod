// 鎏光机 - 登录/注册页面
// 工业风暗色系，与整体设计保持一致
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clapperboard, Eye, EyeOff, Loader2, User, Lock, Phone, Key } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface AuthPageProps {
  onSuccess?: () => void;
}

export default function AuthPage({ onSuccess }: AuthPageProps) {
  const handleSuccess = onSuccess ?? (() => { window.location.href = "/"; });
  const [mode, setMode] = useState<"login" | "register">("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [inviteCode, setInviteCode] = useState("");

  // 从 URL 参数 ?invite=XXXXXX 自动填入邀请码
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inv = params.get("invite");
    if (inv) {
      setInviteCode(inv.trim().toUpperCase());
      setMode("register"); // 有邀请码时自动切换到注册 Tab
    }
  }, []);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      toast.success("登录成功，欢迎回来！");
      handleSuccess();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: (data) => {
      const credits = data.credits ?? 0;
      if (credits > 0) {
        toast.success(`注册成功！邀请码奉上，已获赠 ${credits.toLocaleString()} 积分`);
      } else {
        toast.success("注册成功！欢迎加入鹯光机");
      }
      handleSuccess();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const isLoading = loginMutation.isPending || registerMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password.trim()) {
      toast.error("请填写完整信息");
      return;
    }
    if (mode === "register") {
      if (password !== confirmPassword) {
        toast.error("两次输入的密码不一致");
        return;
      }
      if (password.length < 6) {
        toast.error("密码至少需要6位");
        return;
      }
      registerMutation.mutate({ identifier: identifier.trim(), password, name: name.trim() || undefined, inviteCode: inviteCode.trim().toUpperCase() || undefined });
    } else {
      loginMutation.mutate({ identifier: identifier.trim(), password });
    }
  };

  const BG = "oklch(0.11 0.005 240)";
  const CARD_BG = "oklch(0.15 0.006 240)";
  const BORDER = "oklch(0.22 0.006 240)";
  const GOLD = "oklch(0.75 0.17 65)";
  const TEXT = "oklch(0.88 0.005 60)";
  const MUTED = "oklch(0.50 0.01 240)";
  const INPUT_BG = "oklch(0.12 0.005 240)";

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: BG, fontFamily: "'Noto Sans SC', 'Space Grotesk', sans-serif" }}
    >
      {/* Background grid pattern */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `linear-gradient(${BORDER} 1px, transparent 1px), linear-gradient(90deg, ${BORDER} 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: GOLD }}
          >
            <Clapperboard size={18} style={{ color: "oklch(0.1 0.005 240)" }} />
          </div>
          <div>
            <div className="text-xl font-bold" style={{ color: TEXT, fontFamily: "'Space Grotesk', sans-serif" }}>
              鎏光机
            </div>
            <div className="text-xs tracking-widest uppercase" style={{ color: MUTED, fontFamily: "'JetBrains Mono', monospace" }}>
              AI Film Workflow
            </div>
          </div>
        </div>

        {/* Card */}
        <div
          className="rounded-xl p-8"
          style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}
        >
          {/* Tab switcher */}
          <div
            className="flex rounded-lg p-1 mb-6"
            style={{ background: INPUT_BG, border: `1px solid ${BORDER}` }}
          >
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="flex-1 py-2 rounded-md text-sm font-medium transition-all duration-200"
                style={{
                  background: mode === m ? GOLD : "transparent",
                  color: mode === m ? "oklch(0.1 0.005 240)" : MUTED,
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                {m === "login" ? "登录" : "注册"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="wait">
              {mode === "register" && (
                <motion.div
                  key="name"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <label className="block text-xs mb-1.5" style={{ color: MUTED, fontFamily: "'JetBrains Mono', monospace" }}>
                    昵称（可选）
                  </label>
                  <div className="relative">
                    <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: MUTED }} />
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="你的昵称"
                      className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm outline-none transition-all"
                      style={{
                        background: INPUT_BG,
                        border: `1px solid ${BORDER}`,
                        color: TEXT,
                        fontFamily: "'Noto Sans SC', sans-serif",
                      }}
                      onFocus={e => (e.target.style.borderColor = GOLD)}
                      onBlur={e => (e.target.style.borderColor = BORDER)}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Identifier */}
            <div>
              <label className="block text-xs mb-1.5" style={{ color: MUTED, fontFamily: "'JetBrains Mono', monospace" }}>
                手机号 / 邮箱
              </label>
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: MUTED }} />
                <input
                  type="text"
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  placeholder="输入手机号或邮箱"
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm outline-none transition-all"
                  style={{
                    background: INPUT_BG,
                    border: `1px solid ${BORDER}`,
                    color: TEXT,
                    fontFamily: "'Noto Sans SC', sans-serif",
                  }}
                  onFocus={e => (e.target.style.borderColor = GOLD)}
                  onBlur={e => (e.target.style.borderColor = BORDER)}
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs mb-1.5" style={{ color: MUTED, fontFamily: "'JetBrains Mono', monospace" }}>
                密码
              </label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: MUTED }} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={mode === "register" ? "至少6位密码" : "输入密码"}
                  className="w-full pl-9 pr-10 py-2.5 rounded-lg text-sm outline-none transition-all"
                  style={{
                    background: INPUT_BG,
                    border: `1px solid ${BORDER}`,
                    color: TEXT,
                  }}
                  onFocus={e => (e.target.style.borderColor = GOLD)}
                  onBlur={e => (e.target.style.borderColor = BORDER)}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: MUTED }}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Invite code (register only) */}
            <AnimatePresence mode="wait">
              {mode === "register" && (
                <motion.div
                  key="invite"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <label className="block text-xs mb-1.5" style={{ color: MUTED, fontFamily: "'JetBrains Mono', monospace" }}>
                    邀请码（内测阶段可能需要）
                  </label>
                  <div className="relative">
                    <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: MUTED }} />
                    <input
                      type="text"
                      value={inviteCode}
                      onChange={e => setInviteCode(e.target.value.toUpperCase())}
                      placeholder="输入邀请码（如有）"
                      className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm outline-none transition-all uppercase"
                      style={{
                        background: INPUT_BG,
                        border: `1px solid ${BORDER}`,
                        color: GOLD,
                        fontFamily: "'JetBrains Mono', monospace",
                        letterSpacing: "0.1em",
                      }}
                      onFocus={e => (e.target.style.borderColor = GOLD)}
                      onBlur={e => (e.target.style.borderColor = BORDER)}
                    />
                  </div>
                  {/* 邀请码积分提示 */}
                  <p className="mt-1.5 text-xs flex items-center gap-1" style={{ color: inviteCode ? GOLD : MUTED }}>
                    <span style={{ fontSize: 10 }}>★</span>
                    {inviteCode
                      ? <span>已填写邀请码，注册后将获赠 <strong style={{ color: GOLD }}>3,000</strong> 积分</span>
                      : <span>填写邀请码可获得 <strong style={{ color: GOLD }}>3,000</strong> 积分奖励</span>
                    }
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Confirm password (register only) */}
            <AnimatePresence mode="wait">
              {mode === "register" && (
                <motion.div
                  key="confirm"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <label className="block text-xs mb-1.5" style={{ color: MUTED, fontFamily: "'JetBrains Mono', monospace" }}>
                    确认密码
                  </label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: MUTED }} />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="再次输入密码"
                      className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm outline-none transition-all"
                      style={{
                        background: INPUT_BG,
                        border: `1px solid ${BORDER}`,
                        color: TEXT,
                      }}
                      onFocus={e => (e.target.style.borderColor = GOLD)}
                      onBlur={e => (e.target.style.borderColor = BORDER)}
                      autoComplete="new-password"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-opacity mt-2"
              style={{
                background: GOLD,
                color: "oklch(0.1 0.005 240)",
                fontFamily: "'Space Grotesk', sans-serif",
                opacity: isLoading ? 0.7 : 1,
                cursor: isLoading ? "not-allowed" : "pointer",
              }}
            >
              {isLoading && <Loader2 size={14} className="animate-spin" />}
              {mode === "login" ? "登录" : "立即注册"}
            </button>
          </form>

          {/* Register bonus hint */}
          {mode === "register" && (
            <p className="text-center text-xs mt-4" style={{ color: MUTED }}>
              内测阶段，使用邀请码注册可获赠 <span style={{ color: GOLD, fontWeight: 700 }}>3,000</span> 积分
            </p>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs mt-6" style={{ color: "oklch(0.30 0.008 240)", fontFamily: "'JetBrains Mono', monospace" }}>
          鎏光机 · AI 影片工作流工具
        </p>
      </motion.div>
    </div>
  );
}
