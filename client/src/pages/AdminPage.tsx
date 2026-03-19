// 管理员后台页面
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import {
  Users,
  Coins,
  Zap,
  TrendingUp,
  Shield,
  RefreshCw,
  Plus,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Link } from "wouter";

const ACTION_LABELS: Record<string, string> = {
  analyze_script: "AI 解析剧本",
  generate_shot: "AI 生成分镜",
  generate_prompt: "AI 生成视频提示词",
  register_bonus: "注册赠送",
  admin_grant: "管理员充值",
};

export default function AdminPage() {
  const { user, loading } = useAuth();
  const [page, setPage] = useState(1);
  const [grantDialog, setGrantDialog] = useState<{ open: boolean; userId: number; name: string; currentCredits: number } | null>(null);
  const [grantAmount, setGrantAmount] = useState("1000");
  const [grantNote, setGrantNote] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "stats" | "invites">("overview");
  const [createInviteCount, setCreateInviteCount] = useState("5");
  const [createInviteMaxUses, setCreateInviteMaxUses] = useState("1");
  const [createInviteNote, setCreateInviteNote] = useState("");
  const [newCodes, setNewCodes] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchGrantDialog, setBatchGrantDialog] = useState(false);
  const [batchGrantAmount, setBatchGrantAmount] = useState("1000");
  const [batchGrantNote, setBatchGrantNote] = useState("");

  const { data: overview, refetch: refetchOverview } = trpc.admin.getOverview.useQuery(undefined, { enabled: !!user && user.role === "admin" });
  const { data: inviteCodes, refetch: refetchInvites } = trpc.admin.getInviteCodes.useQuery(undefined, { enabled: !!user && user.role === "admin" });
  const { data: usersData, refetch: refetchUsers } = trpc.admin.getUsers.useQuery({ page, pageSize: 20 }, { enabled: !!user && user.role === "admin" });
  const { data: aiStats } = trpc.admin.getAiStats.useQuery(undefined, { enabled: !!user && user.role === "admin" });
  const { data: dailyStats } = trpc.admin.getDailyStats.useQuery(undefined, { enabled: !!user && user.role === "admin" });

  const grantMutation = trpc.admin.grantCredits.useMutation({
    onSuccess: (data) => {
      toast.success(`充值成功，新余额：${data.newBalance} 积分`);
      setGrantDialog(null);
      setGrantAmount("1000");
      setGrantNote("");
      refetchUsers();
      refetchOverview();
    },
    onError: (err) => {
      toast.error(`充值失败：${err.message}`);
    },
  });

  const batchGrantMutation = trpc.admin.batchGrantCredits.useMutation({
    onSuccess: (data) => {
      toast.success(`批量充值成功，共 ${data.count} 名用户`);
      setBatchGrantDialog(false);
      setBatchGrantAmount("1000");
      setBatchGrantNote("");
      setSelectedIds(new Set());
      refetchUsers();
      refetchOverview();
    },
    onError: (err) => toast.error(`批量充值失败：${err.message}`),
  });

  const batchSetRoleMutation = trpc.admin.batchSetRole.useMutation({
    onSuccess: (data) => {
      toast.success(`批量修改角色成功，共 ${data.count} 名用户`);
      setSelectedIds(new Set());
      refetchUsers();
    },
    onError: (err) => toast.error(`批量修改角色失败：${err.message}`),
  });

  const setRoleMutation = trpc.admin.setUserRole.useMutation({
    onSuccess: () => {
      toast.success("角色已更新");
      refetchUsers();
    },
    onError: (err) => {
      toast.error(`操作失败：${err.message}`);
    },
  });

  const createInviteMutation = trpc.admin.createInviteCode.useMutation({
    onSuccess: (data) => {
      toast.success(`成功生成 ${data.codes.length} 个邀请码`);
      setNewCodes(data.codes);
      refetchInvites();
    },
    onError: (err) => toast.error(`生成失败：${err.message}`),
  });

  const deleteInviteMutation = trpc.admin.deleteInviteCode.useMutation({
    onSuccess: () => {
      toast.success("删除成功");
      refetchInvites();
    },
    onError: (err) => toast.error(`删除失败：${err.message}`),
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "oklch(0.13 0.005 240)" }}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p style={{ color: "oklch(0.60 0.008 240)", fontFamily: "'JetBrains Mono', monospace", fontSize: "12px" }}>
            LOADING...
          </p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "oklch(0.13 0.005 240)" }}>
        <div className="text-center space-y-4">
          <Shield className="w-16 h-16 mx-auto" style={{ color: "oklch(0.75 0.17 65)" }} />
          <h1 className="text-2xl font-bold" style={{ color: "oklch(0.88 0.005 60)", fontFamily: "'Space Grotesk', sans-serif" }}>
            无权访问
          </h1>
          <p style={{ color: "oklch(0.55 0.008 240)" }}>
            {!user ? "请先登录管理员账号" : "您没有管理员权限"}
          </p>
          <Link href="/">
            <Button variant="outline" style={{ borderColor: "oklch(0.30 0.008 240)", color: "oklch(0.70 0.008 240)" }}>
              返回首页
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "overview", label: "概览", icon: TrendingUp },
    { id: "users", label: "用户管理", icon: Users },
    { id: "stats", label: "AI 使用统计", icon: Zap },
    { id: "invites", label: "邀请码", icon: Plus },
  ] as const;

  return (
    <div className="min-h-screen" style={{ background: "oklch(0.13 0.005 240)" }}>
      {/* 顶部导航 */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b"
        style={{ background: "oklch(0.15 0.006 240)", borderColor: "oklch(0.22 0.006 240)" }}
      >
        <div className="flex items-center gap-3">
          <Link href="/">
            <button
              className="flex items-center gap-1 text-xs hover:opacity-80 transition-opacity"
              style={{ color: "oklch(0.55 0.008 240)", fontFamily: "'JetBrains Mono', monospace" }}
            >
              <ChevronLeft className="w-3 h-3" />
              返回工具
            </button>
          </Link>
          <div className="w-px h-4" style={{ background: "oklch(0.28 0.008 240)" }} />
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4" style={{ color: "oklch(0.75 0.17 65)" }} />
            <span className="text-sm font-bold" style={{ color: "oklch(0.88 0.005 60)", fontFamily: "'Space Grotesk', sans-serif" }}>
              管理员后台
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "oklch(0.55 0.008 240)", fontFamily: "'JetBrains Mono', monospace" }}>
            {user.identifier || user.name}
          </span>
          <Badge className="text-xs" style={{ background: "oklch(0.75 0.17 65 / 0.2)", color: "oklch(0.75 0.17 65)", border: "none" }}>
            ADMIN
          </Badge>
        </div>
      </div>

      {/* Tab 导航 */}
      <div className="flex gap-1 px-6 pt-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: isActive ? "oklch(0.75 0.17 65 / 0.15)" : "transparent",
                color: isActive ? "oklch(0.75 0.17 65)" : "oklch(0.55 0.008 240)",
                border: isActive ? "1px solid oklch(0.75 0.17 65 / 0.3)" : "1px solid transparent",
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="px-6 py-6 space-y-6">
        {/* ── 概览 Tab ── */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* 统计卡片 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "注册用户总数", value: overview?.totalUsers ?? "—", icon: Users, color: "oklch(0.65 0.15 250)" },
                { label: "已发放积分", value: overview?.totalCreditsGranted?.toLocaleString() ?? "—", icon: Coins, color: "oklch(0.75 0.17 65)" },
                { label: "已消耗积分", value: overview?.totalCreditsConsumed?.toLocaleString() ?? "—", icon: TrendingUp, color: "oklch(0.65 0.18 140)" },
                { label: "AI 调用总次数", value: overview?.totalAiCalls?.toLocaleString() ?? "—", icon: Zap, color: "oklch(0.70 0.20 300)" },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <Card key={item.label} style={{ background: "oklch(0.17 0.006 240)", border: "1px solid oklch(0.22 0.006 240)" }}>
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs mb-1" style={{ color: "oklch(0.50 0.008 240)", fontFamily: "'JetBrains Mono', monospace" }}>
                            {item.label}
                          </p>
                          <p className="text-2xl font-bold" style={{ color: "oklch(0.88 0.005 60)", fontFamily: "'Space Grotesk', sans-serif" }}>
                            {item.value}
                          </p>
                        </div>
                        <Icon className="w-5 h-5 mt-1" style={{ color: item.color }} />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* 每日调用趋势图 */}
            {dailyStats && dailyStats.length > 0 && (
              <Card style={{ background: "oklch(0.17 0.006 240)", border: "1px solid oklch(0.22 0.006 240)" }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium" style={{ color: "oklch(0.70 0.008 240)", fontFamily: "'Space Grotesk', sans-serif" }}>
                    近 30 天 AI 调用趋势
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={dailyStats}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.006 240)" />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: "oklch(0.45 0.008 240)", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
                        tickFormatter={(v) => v.slice(5)}
                      />
                      <YAxis tick={{ fill: "oklch(0.45 0.008 240)", fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{ background: "oklch(0.20 0.006 240)", border: "1px solid oklch(0.28 0.008 240)", borderRadius: "8px" }}
                        labelStyle={{ color: "oklch(0.70 0.008 240)" }}
                        itemStyle={{ color: "oklch(0.75 0.17 65)" }}
                      />
                      <Line type="monotone" dataKey="calls" stroke="oklch(0.75 0.17 65)" strokeWidth={2} dot={false} name="调用次数" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ── 用户管理 Tab ── */}
        {activeTab === "users" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <p className="text-sm" style={{ color: "oklch(0.55 0.008 240)", fontFamily: "'JetBrains Mono', monospace" }}>
                  共 {usersData?.total ?? 0} 名用户
                </p>
                {selectedIds.size > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "oklch(0.75 0.17 65 / 0.15)", color: "oklch(0.75 0.17 65)", border: "1px solid oklch(0.75 0.17 65 / 0.3)", fontFamily: "'JetBrains Mono', monospace" }}>
                    已选 {selectedIds.size} 人
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {selectedIds.size > 0 && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-3 text-xs"
                      style={{ color: "oklch(0.75 0.17 65)", border: "1px solid oklch(0.75 0.17 65 / 0.3)" }}
                      onClick={() => setBatchGrantDialog(true)}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      批量充值
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-3 text-xs"
                      style={{ color: "oklch(0.65 0.15 250)", border: "1px solid oklch(0.65 0.15 250 / 0.3)" }}
                      onClick={() => {
                        if (confirm(`将选中的 ${selectedIds.size} 名用户设为管理员？`)) {
                          batchSetRoleMutation.mutate({ userIds: Array.from(selectedIds), role: "admin" });
                        }
                      }}
                    >
                      <Shield className="w-3 h-3 mr-1" />
                      设为管理员
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-3 text-xs"
                      style={{ color: "oklch(0.55 0.008 240)", border: "1px solid oklch(0.28 0.008 240)" }}
                      onClick={() => {
                        if (confirm(`将选中的 ${selectedIds.size} 名用户设为普通用户？`)) {
                          batchSetRoleMutation.mutate({ userIds: Array.from(selectedIds), role: "user" });
                        }
                      }}
                    >
                      设为普通用户
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      style={{ color: "oklch(0.55 0.008 240)" }}
                      onClick={() => setSelectedIds(new Set())}
                    >
                      取消选择
                    </Button>
                  </>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => refetchUsers()}
                  style={{ color: "oklch(0.55 0.008 240)" }}
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  刷新
                </Button>
              </div>
            </div>

            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid oklch(0.22 0.006 240)" }}>
              <Table>
                <TableHeader>
                  <TableRow style={{ background: "oklch(0.17 0.006 240)", borderColor: "oklch(0.22 0.006 240)" }}>
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        className="cursor-pointer"
                        style={{ accentColor: "oklch(0.75 0.17 65)" }}
                        checked={(usersData?.users?.length ?? 0) > 0 && (usersData?.users ?? []).every(u => selectedIds.has(u.id))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(new Set(usersData?.users?.map(u => u.id) ?? []));
                          } else {
                            setSelectedIds(new Set());
                          }
                        }}
                      />
                    </TableHead>
                    {["ID", "账号", "昵称", "角色", "积分余额", "注册时间", "最后登录", "操作"].map((h) => (
                      <TableHead key={h} className="text-xs" style={{ color: "oklch(0.50 0.008 240)", fontFamily: "'JetBrains Mono', monospace" }}>
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(usersData?.users ?? []).map((u) => (
                    <TableRow
                      key={u.id}
                      style={{ borderColor: "oklch(0.20 0.006 240)", background: selectedIds.has(u.id) ? "oklch(0.18 0.008 240)" : "oklch(0.15 0.005 240)" }}
                      className="hover:bg-[oklch(0.18_0.006_240)] transition-colors cursor-pointer"
                      onClick={() => {
                        setSelectedIds(prev => {
                          const next = new Set(prev);
                          if (next.has(u.id)) next.delete(u.id); else next.add(u.id);
                          return next;
                        });
                      }}
                    >
                      <TableCell className="w-10" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="cursor-pointer"
                          style={{ accentColor: "oklch(0.75 0.17 65)" }}
                          checked={selectedIds.has(u.id)}
                          onChange={(e) => {
                            setSelectedIds(prev => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(u.id); else next.delete(u.id);
                              return next;
                            });
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-xs font-mono" style={{ color: "oklch(0.45 0.008 240)" }}>
                        {u.id}
                      </TableCell>
                      <TableCell className="text-xs" style={{ color: "oklch(0.70 0.008 240)" }}>
                        {u.identifier ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs" style={{ color: "oklch(0.70 0.008 240)" }}>
                        {u.name ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className="text-xs cursor-pointer"
                          style={{
                            background: u.role === "admin" ? "oklch(0.75 0.17 65 / 0.2)" : "oklch(0.30 0.008 240)",
                            color: u.role === "admin" ? "oklch(0.75 0.17 65)" : "oklch(0.60 0.008 240)",
                            border: "none",
                          }}
                          onClick={() => {
                            const newRole = u.role === "admin" ? "user" : "admin";
                            if (confirm(`将用户 ${u.identifier ?? u.id} 的角色改为 ${newRole}？`)) {
                              setRoleMutation.mutate({ userId: u.id, role: newRole });
                            }
                          }}
                        >
                          {u.role === "admin" ? "管理员" : "普通用户"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span
                          className="text-sm font-bold font-mono"
                          style={{ color: u.credits < 100 ? "oklch(0.65 0.20 25)" : "oklch(0.65 0.18 140)" }}
                        >
                          {u.credits.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs font-mono" style={{ color: "oklch(0.45 0.008 240)" }}>
                        {new Date(u.createdAt).toLocaleDateString("zh-CN")}
                      </TableCell>
                      <TableCell className="text-xs font-mono" style={{ color: "oklch(0.45 0.008 240)" }}>
                        {new Date(u.lastSignedIn).toLocaleDateString("zh-CN")}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          style={{ color: "oklch(0.75 0.17 65)", border: "1px solid oklch(0.75 0.17 65 / 0.3)" }}
                          onClick={() => setGrantDialog({
                            open: true,
                            userId: u.id,
                            name: u.identifier ?? String(u.id),
                            currentCredits: u.credits,
                          })}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          充值
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* 分页 */}
            {(usersData?.total ?? 0) > 20 && (
              <div className="flex items-center justify-center gap-3">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                  style={{ color: "oklch(0.55 0.008 240)" }}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs font-mono" style={{ color: "oklch(0.55 0.008 240)" }}>
                  第 {page} 页 / 共 {Math.ceil((usersData?.total ?? 0) / 20)} 页
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={page >= Math.ceil((usersData?.total ?? 0) / 20)}
                  onClick={() => setPage(p => p + 1)}
                  style={{ color: "oklch(0.55 0.008 240)" }}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── AI 使用统计 Tab ── */}
        {activeTab === "invites" && (
          <div className="space-y-6">
            {/* 生成邀请码表单 */}
            <Card style={{ background: "oklch(0.17 0.006 240)", border: "1px solid oklch(0.22 0.006 240)" }}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium" style={{ color: "oklch(0.75 0.17 65)", fontFamily: "'Space Grotesk', sans-serif" }}>
                  生成邀请码
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: "oklch(0.55 0.008 240)", fontFamily: "'JetBrains Mono', monospace" }}>数量</label>
                    <Input
                      type="number" min={1} max={100}
                      value={createInviteCount}
                      onChange={(e) => setCreateInviteCount(e.target.value)}
                      className="text-sm"
                      style={{ background: "oklch(0.20 0.006 240)", border: "1px solid oklch(0.28 0.008 240)", color: "oklch(0.88 0.005 60)" }}
                    />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: "oklch(0.55 0.008 240)", fontFamily: "'JetBrains Mono', monospace" }}>每码可用次数</label>
                    <Input
                      type="number" min={1} max={100}
                      value={createInviteMaxUses}
                      onChange={(e) => setCreateInviteMaxUses(e.target.value)}
                      className="text-sm"
                      style={{ background: "oklch(0.20 0.006 240)", border: "1px solid oklch(0.28 0.008 240)", color: "oklch(0.88 0.005 60)" }}
                    />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: "oklch(0.55 0.008 240)", fontFamily: "'JetBrains Mono', monospace" }}>备注（可选）</label>
                    <Input
                      value={createInviteNote}
                      onChange={(e) => setCreateInviteNote(e.target.value)}
                      placeholder="如：内测小伙伴"
                      className="text-sm"
                      style={{ background: "oklch(0.20 0.006 240)", border: "1px solid oklch(0.28 0.008 240)", color: "oklch(0.88 0.005 60)" }}
                    />
                  </div>
                </div>
                <Button
                  disabled={createInviteMutation.isPending}
                  onClick={() => {
                    setNewCodes([]);
                    createInviteMutation.mutate({
                      count: Number(createInviteCount),
                      maxUses: Number(createInviteMaxUses),
                      note: createInviteNote || undefined,
                    });
                  }}
                  style={{ background: "oklch(0.75 0.17 65)", color: "oklch(0.13 0.005 240)" }}
                >
                  {createInviteMutation.isPending ? "生成中..." : `生成 ${createInviteCount} 个邀请码`}
                </Button>
                {newCodes.length > 0 && (
                  <div className="mt-3 p-3 rounded-lg" style={{ background: "oklch(0.20 0.008 65 / 0.3)", border: "1px solid oklch(0.75 0.17 65 / 0.3)" }}>
                    <div className="text-xs mb-2" style={{ color: "oklch(0.75 0.17 65)", fontFamily: "'JetBrains Mono', monospace" }}>新生成的邀请码：</div>
                    <div className="flex flex-wrap gap-2">
                      {newCodes.map(code => (
                        <button
                          key={code}
                          onClick={() => { navigator.clipboard.writeText(code); toast.success(`已复制：${code}`); }}
                          className="px-3 py-1 rounded text-xs font-mono font-bold transition-colors hover:opacity-80"
                          style={{ background: "oklch(0.75 0.17 65 / 0.2)", color: "oklch(0.75 0.17 65)", border: "1px solid oklch(0.75 0.17 65 / 0.4)" }}
                        >
                          {code}
                        </button>
                      ))}
                    </div>
                    <div className="text-xs mt-2" style={{ color: "oklch(0.50 0.008 240)" }}>点击邀请码可复制到剪贴板</div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 邀请码列表 */}
            <Card style={{ background: "oklch(0.17 0.006 240)", border: "1px solid oklch(0.22 0.006 240)" }}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center justify-between" style={{ color: "oklch(0.70 0.008 240)", fontFamily: "'Space Grotesk', sans-serif" }}>
                  <span>邀请码列表（共 {inviteCodes?.length ?? 0} 个）</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {!inviteCodes || inviteCodes.length === 0 ? (
                  <div className="py-12 text-center text-sm" style={{ color: "oklch(0.45 0.008 240)" }}>暂无邀请码</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow style={{ borderColor: "oklch(0.22 0.006 240)" }}>
                        {["邀请码", "使用次数", "最大次数", "备注", "创建时间", "操作"].map(h => (
                          <TableHead key={h} className="text-xs" style={{ color: "oklch(0.50 0.008 240)", fontFamily: "'JetBrains Mono', monospace" }}>{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inviteCodes.map(inv => {
                        const isUsed = inv.useCount >= inv.maxUses;
                        const isExpired = inv.expiresAt ? Date.now() > inv.expiresAt : false;
                        return (
                          <TableRow key={inv.id} style={{ borderColor: "oklch(0.20 0.006 240)", opacity: isUsed || isExpired ? 0.5 : 1 }}>
                            <TableCell>
                              <button
                                onClick={() => { navigator.clipboard.writeText(inv.code); toast.success(`已复制：${inv.code}`); }}
                                className="font-mono font-bold text-sm hover:opacity-80 transition-opacity"
                                style={{ color: isUsed ? "oklch(0.45 0.008 240)" : "oklch(0.75 0.17 65)" }}
                              >
                                {inv.code}
                              </button>
                              {isUsed && <Badge className="ml-2 text-[10px]" style={{ background: "oklch(0.30 0.008 240)", color: "oklch(0.55 0.008 240)" }}>已用尽</Badge>}
                              {isExpired && <Badge className="ml-2 text-[10px]" style={{ background: "oklch(0.30 0.008 240)", color: "oklch(0.55 0.008 240)" }}>已过期</Badge>}
                            </TableCell>
                            <TableCell className="text-sm font-mono" style={{ color: "oklch(0.70 0.008 240)" }}>{inv.useCount}</TableCell>
                            <TableCell className="text-sm font-mono" style={{ color: "oklch(0.70 0.008 240)" }}>{inv.maxUses}</TableCell>
                            <TableCell className="text-xs" style={{ color: "oklch(0.55 0.008 240)" }}>{inv.note ?? "—"}</TableCell>
                            <TableCell className="text-xs" style={{ color: "oklch(0.45 0.008 240)" }}>
                              {new Date(inv.createdAt).toLocaleDateString("zh-CN")}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    const url = `${window.location.origin}/auth?invite=${inv.code}`;
                                    navigator.clipboard.writeText(url);
                                    toast.success("分享链接已复制");
                                  }}
                                  className="text-xs px-2 py-1 rounded hover:opacity-80 transition-opacity"
                                  style={{ color: "oklch(0.75 0.17 65)", border: "1px solid oklch(0.75 0.17 65 / 0.4)", background: "transparent" }}
                                >
                                  复制链接
                                </button>
                                <button
                                  onClick={() => deleteInviteMutation.mutate({ id: inv.id })}
                                  className="text-xs px-2 py-1 rounded hover:opacity-80 transition-opacity"
                                  style={{ color: "oklch(0.60 0.15 30)", border: "1px solid oklch(0.60 0.15 30 / 0.4)", background: "transparent" }}
                                >
                                  删除
                                </button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* 邀请码开关说明 */}
            <Card style={{ background: "oklch(0.17 0.006 240)", border: "1px solid oklch(0.22 0.006 240)" }}>
              <CardContent className="pt-4">
                <div className="text-xs space-y-1" style={{ color: "oklch(0.50 0.008 240)" }}>
                  <p>ℹ️ 邀请码开关：在服务器环境变量中设置 <code className="px-1 py-0.5 rounded" style={{ background: "oklch(0.22 0.006 240)", color: "oklch(0.75 0.17 65)" }}>REQUIRE_INVITE_CODE=true</code> 即可开启邀请码注册限制。</p>
                  <p>• 开启后，所有新用户注册必须提供有效邀请码才能完成注册。</p>
                  <p>• 未开启时，邀请码输入框仍会显示（如果填写了就会记录），但不强制验证。</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "stats" && (
          <div className="space-y-6">
            {/* 操作类型柱状图 */}
            {aiStats && aiStats.length > 0 ? (
              <Card style={{ background: "oklch(0.17 0.006 240)", border: "1px solid oklch(0.22 0.006 240)" }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium" style={{ color: "oklch(0.70 0.008 240)", fontFamily: "'Space Grotesk', sans-serif" }}>
                    AI 操作类型分布（累计）
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={aiStats.map(s => ({ ...s, label: ACTION_LABELS[s.action] ?? s.action }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.006 240)" />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "oklch(0.55 0.008 240)", fontSize: 11, fontFamily: "'Space Grotesk', sans-serif" }}
                      />
                      <YAxis tick={{ fill: "oklch(0.45 0.008 240)", fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{ background: "oklch(0.20 0.006 240)", border: "1px solid oklch(0.28 0.008 240)", borderRadius: "8px" }}
                        labelStyle={{ color: "oklch(0.70 0.008 240)" }}
                        itemStyle={{ color: "oklch(0.75 0.17 65)" }}
                      />
                      <Bar dataKey="count" fill="oklch(0.75 0.17 65)" radius={[4, 4, 0, 0]} name="调用次数" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            ) : (
              <div className="text-center py-16" style={{ color: "oklch(0.45 0.008 240)" }}>
                <Zap className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">暂无 AI 使用记录</p>
              </div>
            )}

            {/* 统计明细表 */}
            {aiStats && aiStats.length > 0 && (
              <Card style={{ background: "oklch(0.17 0.006 240)", border: "1px solid oklch(0.22 0.006 240)" }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium" style={{ color: "oklch(0.70 0.008 240)", fontFamily: "'Space Grotesk', sans-serif" }}>
                    操作明细
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow style={{ borderColor: "oklch(0.22 0.006 240)" }}>
                        {["操作类型", "调用次数", "消耗积分"].map(h => (
                          <TableHead key={h} className="text-xs" style={{ color: "oklch(0.50 0.008 240)", fontFamily: "'JetBrains Mono', monospace" }}>
                            {h}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {aiStats.map(s => (
                        <TableRow key={s.action} style={{ borderColor: "oklch(0.20 0.006 240)" }}>
                          <TableCell className="text-sm" style={{ color: "oklch(0.70 0.008 240)" }}>
                            {ACTION_LABELS[s.action] ?? s.action}
                          </TableCell>
                          <TableCell className="text-sm font-mono font-bold" style={{ color: "oklch(0.75 0.17 65)" }}>
                            {s.count.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-sm font-mono" style={{ color: "oklch(0.65 0.18 140)" }}>
                            {s.totalCredits.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* 批量充值对话框 */}
      {batchGrantDialog && (
        <Dialog open onOpenChange={() => setBatchGrantDialog(false)}>
          <DialogContent style={{ background: "oklch(0.17 0.006 240)", border: "1px solid oklch(0.28 0.008 240)" }}>
            <DialogHeader>
              <DialogTitle style={{ color: "oklch(0.88 0.005 60)", fontFamily: "'Space Grotesk', sans-serif" }}>
                批量充値积分
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <p className="text-sm" style={{ color: "oklch(0.65 0.008 240)" }}>
                将向选中的 <span style={{ color: "oklch(0.75 0.17 65)", fontWeight: 600 }}>{selectedIds.size} 名用户</span> 充値积分
              </p>
              <div>
                <label className="text-xs mb-1 block" style={{ color: "oklch(0.55 0.008 240)", fontFamily: "'JetBrains Mono', monospace" }}>
                  充値数量
                </label>
                <Input
                  type="number"
                  value={batchGrantAmount}
                  onChange={(e) => setBatchGrantAmount(e.target.value)}
                  min={1}
                  className="text-sm"
                  style={{ background: "oklch(0.20 0.006 240)", border: "1px solid oklch(0.28 0.008 240)", color: "oklch(0.88 0.005 60)" }}
                />
                <div className="flex gap-2 mt-2">
                  {[1000, 5000, 10000, 50000].map(v => (
                    <button
                      key={v}
                      onClick={() => setBatchGrantAmount(String(v))}
                      className="text-xs px-2 py-1 rounded transition-colors"
                      style={{
                        background: batchGrantAmount === String(v) ? "oklch(0.75 0.17 65 / 0.2)" : "oklch(0.22 0.006 240)",
                        color: batchGrantAmount === String(v) ? "oklch(0.75 0.17 65)" : "oklch(0.55 0.008 240)",
                        border: `1px solid ${batchGrantAmount === String(v) ? "oklch(0.75 0.17 65 / 0.4)" : "oklch(0.28 0.008 240)"}`,
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      +{v.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: "oklch(0.55 0.008 240)", fontFamily: "'JetBrains Mono', monospace" }}>
                  备注（可选）
                </label>
                <Input
                  value={batchGrantNote}
                  onChange={(e) => setBatchGrantNote(e.target.value)}
                  placeholder="如：活动赠送"
                  className="text-sm"
                  style={{ background: "oklch(0.20 0.006 240)", border: "1px solid oklch(0.28 0.008 240)", color: "oklch(0.88 0.005 60)" }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setBatchGrantDialog(false)}
                style={{ color: "oklch(0.55 0.008 240)" }}
              >
                取消
              </Button>
              <Button
                disabled={batchGrantMutation.isPending || !batchGrantAmount || Number(batchGrantAmount) < 1}
                onClick={() => {
                  batchGrantMutation.mutate({
                    userIds: Array.from(selectedIds),
                    amount: Number(batchGrantAmount),
                    note: batchGrantNote || undefined,
                  });
                }}
                style={{ background: "oklch(0.75 0.17 65)", color: "oklch(0.13 0.005 240)" }}
              >
                {batchGrantMutation.isPending ? "充値中..." : `确认充値 ${Number(batchGrantAmount).toLocaleString()} 积分 × ${selectedIds.size} 人`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* 充值对话框 */}
      {grantDialog?.open && (
        <Dialog open onOpenChange={() => setGrantDialog(null)}>
          <DialogContent style={{ background: "oklch(0.17 0.006 240)", border: "1px solid oklch(0.28 0.008 240)" }}>
            <DialogHeader>
              <DialogTitle style={{ color: "oklch(0.88 0.005 60)", fontFamily: "'Space Grotesk', sans-serif" }}>
                充值积分
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <p className="text-xs mb-1" style={{ color: "oklch(0.55 0.008 240)", fontFamily: "'JetBrains Mono', monospace" }}>
                  用户
                </p>
                <p className="text-sm font-medium" style={{ color: "oklch(0.80 0.008 240)" }}>
                  {grantDialog.name}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "oklch(0.50 0.008 240)" }}>
                  当前余额：{grantDialog.currentCredits.toLocaleString()} 积分
                </p>
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: "oklch(0.55 0.008 240)", fontFamily: "'JetBrains Mono', monospace" }}>
                  充值数量
                </label>
                <Input
                  type="number"
                  value={grantAmount}
                  onChange={(e) => setGrantAmount(e.target.value)}
                  min={1}
                  className="text-sm"
                  style={{ background: "oklch(0.20 0.006 240)", border: "1px solid oklch(0.28 0.008 240)", color: "oklch(0.88 0.005 60)" }}
                />
                <div className="flex gap-2 mt-2">
                  {[1000, 5000, 10000, 50000].map(v => (
                    <button
                      key={v}
                      onClick={() => setGrantAmount(String(v))}
                      className="text-xs px-2 py-1 rounded transition-colors"
                      style={{
                        background: grantAmount === String(v) ? "oklch(0.75 0.17 65 / 0.2)" : "oklch(0.22 0.006 240)",
                        color: grantAmount === String(v) ? "oklch(0.75 0.17 65)" : "oklch(0.55 0.008 240)",
                        border: `1px solid ${grantAmount === String(v) ? "oklch(0.75 0.17 65 / 0.4)" : "oklch(0.28 0.008 240)"}`,
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      +{v.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: "oklch(0.55 0.008 240)", fontFamily: "'JetBrains Mono', monospace" }}>
                  备注（可选）
                </label>
                <Input
                  value={grantNote}
                  onChange={(e) => setGrantNote(e.target.value)}
                  placeholder="如：活动赠送"
                  className="text-sm"
                  style={{ background: "oklch(0.20 0.006 240)", border: "1px solid oklch(0.28 0.008 240)", color: "oklch(0.88 0.005 60)" }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setGrantDialog(null)}
                style={{ color: "oklch(0.55 0.008 240)" }}
              >
                取消
              </Button>
              <Button
                disabled={grantMutation.isPending || !grantAmount || Number(grantAmount) < 1}
                onClick={() => {
                  grantMutation.mutate({
                    userId: grantDialog.userId,
                    amount: Number(grantAmount),
                    note: grantNote || undefined,
                  });
                }}
                style={{ background: "oklch(0.75 0.17 65)", color: "oklch(0.13 0.005 240)" }}
              >
                {grantMutation.isPending ? "充值中..." : `确认充值 ${Number(grantAmount).toLocaleString()} 积分`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
