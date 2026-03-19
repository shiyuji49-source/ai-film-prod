import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Coins, TrendingDown, TrendingUp, Zap, FileText, Film, ShoppingCart } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";

const ACTION_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  register_bonus: { label: "注册赠送", icon: <Coins className="w-4 h-4" />, color: "text-emerald-400" },
  admin_grant: { label: "管理员充值", icon: <TrendingUp className="w-4 h-4" />, color: "text-blue-400" },
  stripe_purchase: { label: "购买积分", icon: <ShoppingCart className="w-4 h-4" />, color: "text-purple-400" },
  analyze_script: { label: "AI 解析剧本", icon: <FileText className="w-4 h-4" />, color: "text-amber-400" },
  generate_shot: { label: "AI 生成分镜", icon: <Film className="w-4 h-4" />, color: "text-orange-400" },
  generate_prompt: { label: "AI 生成视频提示词", icon: <Zap className="w-4 h-4" />, color: "text-red-400" },
};

export default function CreditsPage() {
  const { user, isAuthenticated } = useAuth();
  const [limit, setLimit] = useState(30);

  const { data: logs, isLoading } = trpc.auth.creditLogs.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "oklch(0.13 0.005 240)" }}>
        <div className="text-center">
          <p style={{ color: "oklch(0.60 0.008 240)" }}>请先登录</p>
          <Link href="/">
            <Button className="mt-4" variant="outline">返回首页</Button>
          </Link>
        </div>
      </div>
    );
  }

  const totalConsumed = logs?.filter(l => l.delta < 0).reduce((s, l) => s + Math.abs(l.delta), 0) ?? 0;
  const totalEarned = logs?.filter(l => l.delta > 0).reduce((s, l) => s + l.delta, 0) ?? 0;

  return (
    <div className="min-h-screen" style={{ background: "oklch(0.13 0.005 240)" }}>
      {/* 顶部导航 */}
      <div className="border-b px-6 py-4 flex items-center gap-4"
        style={{ borderColor: "oklch(0.22 0.006 240)", background: "oklch(0.15 0.006 240)" }}>
        <Link href="/">
          <button className="flex items-center gap-2 text-sm transition-colors hover:opacity-80"
            style={{ color: "oklch(0.70 0.008 240)" }}>
            <ArrowLeft className="w-4 h-4" />
            返回
          </button>
        </Link>
        <div className="h-4 w-px" style={{ background: "oklch(0.25 0.008 240)" }} />
        <h1 className="text-base font-semibold" style={{ color: "oklch(0.88 0.005 60)", fontFamily: "'Space Grotesk', sans-serif" }}>
          积分明细
        </h1>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* 积分概览卡片 */}
        <div className="grid grid-cols-3 gap-4">
          <Card style={{ background: "oklch(0.17 0.006 240)", border: "1px solid oklch(0.25 0.008 240)" }}>
            <CardContent className="pt-4 pb-4">
              <div className="text-xs mb-1" style={{ color: "oklch(0.55 0.008 240)" }}>当前余额</div>
              <div className="text-2xl font-bold" style={{ color: "oklch(0.75 0.17 65)", fontFamily: "'JetBrains Mono', monospace" }}>
                {user?.credits?.toLocaleString() ?? "—"}
              </div>
            </CardContent>
          </Card>
          <Card style={{ background: "oklch(0.17 0.006 240)", border: "1px solid oklch(0.25 0.008 240)" }}>
            <CardContent className="pt-4 pb-4">
              <div className="text-xs mb-1" style={{ color: "oklch(0.55 0.008 240)" }}>已消耗（近30条）</div>
              <div className="text-2xl font-bold" style={{ color: "oklch(0.70 0.15 30)", fontFamily: "'JetBrains Mono', monospace" }}>
                -{totalConsumed.toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card style={{ background: "oklch(0.17 0.006 240)", border: "1px solid oklch(0.25 0.008 240)" }}>
            <CardContent className="pt-4 pb-4">
              <div className="text-xs mb-1" style={{ color: "oklch(0.55 0.008 240)" }}>已获得（近30条）</div>
              <div className="text-2xl font-bold" style={{ color: "oklch(0.65 0.15 145)", fontFamily: "'JetBrains Mono', monospace" }}>
                +{totalEarned.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 积分规则说明 */}
        <Card style={{ background: "oklch(0.17 0.006 240)", border: "1px solid oklch(0.25 0.008 240)" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm" style={{ color: "oklch(0.75 0.17 65)" }}>积分消耗规则</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 text-xs" style={{ color: "oklch(0.65 0.008 240)" }}>
              <div className="flex items-center gap-2">
                <FileText className="w-3 h-3" style={{ color: "oklch(0.75 0.17 65)" }} />
                AI 解析剧本：<span style={{ color: "oklch(0.75 0.17 65)" }}>-1 积分/次</span>
              </div>
              <div className="flex items-center gap-2">
                <Film className="w-3 h-3" style={{ color: "oklch(0.75 0.17 65)" }} />
                AI 生成分镜：<span style={{ color: "oklch(0.75 0.17 65)" }}>-1 积分/个</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-3 h-3" style={{ color: "oklch(0.75 0.17 65)" }} />
                AI 生成视频提示词：<span style={{ color: "oklch(0.75 0.17 65)" }}>-3 积分/条</span>
              </div>
              <div className="flex items-center gap-2">
                <Coins className="w-3 h-3" style={{ color: "oklch(0.65 0.15 145)" }} />
                新用户注册：<span style={{ color: "oklch(0.65 0.15 145)" }}>+10,000 积分</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 流水明细 */}
        <Card style={{ background: "oklch(0.17 0.006 240)", border: "1px solid oklch(0.25 0.008 240)" }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between" style={{ color: "oklch(0.80 0.005 60)" }}>
              <span>积分流水（最近 {logs?.length ?? 0} 条）</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-12 text-center text-sm" style={{ color: "oklch(0.45 0.008 240)" }}>
                加载中...
              </div>
            ) : !logs || logs.length === 0 ? (
              <div className="py-12 text-center text-sm" style={{ color: "oklch(0.45 0.008 240)" }}>
                暂无积分记录
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: "oklch(0.22 0.006 240)" }}>
                {logs.map((log) => {
                  const info = ACTION_LABELS[log.action] ?? { label: log.action, icon: <Coins className="w-4 h-4" />, color: "text-gray-400" };
                  const isPositive = log.delta > 0;
                  return (
                    <div key={log.id} className="flex items-center justify-between px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className={`${info.color}`}>{info.icon}</div>
                        <div>
                          <div className="text-sm font-medium" style={{ color: "oklch(0.80 0.005 60)" }}>
                            {info.label}
                          </div>
                          {log.note && (
                            <div className="text-xs mt-0.5" style={{ color: "oklch(0.50 0.008 240)" }}>
                              {log.note}
                            </div>
                          )}
                          <div className="text-xs mt-0.5" style={{ color: "oklch(0.40 0.008 240)" }}>
                            {new Date(log.createdAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold font-mono" style={{ color: isPositive ? "oklch(0.65 0.15 145)" : "oklch(0.70 0.15 30)" }}>
                          {isPositive ? "+" : ""}{log.delta.toLocaleString()}
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: "oklch(0.45 0.008 240)" }}>
                          余额 {log.balance.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
