// DESIGN: "鎏光机" 导演手册工业风暗色系
// API 设置页面 — 支持多提供商切换、实时测试
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ArrowLeft, CheckCircle2, XCircle, Loader2, Zap,
  Settings, Key, Globe, ChevronDown, ChevronUp, Info,
  Clock, Wifi, WifiOff,
} from "lucide-react";
import { Link } from "wouter";

const PROVIDER_ICONS: Record<string, string> = {
  gemini: "🤖",
  openai: "🧠",
  anthropic: "🌟",
  kimi: "🌙",
  deepseek: "🔍",
  custom: "⚙️",
};

const PROVIDER_COLORS: Record<string, string> = {
  gemini: "oklch(0.65 0.20 145)",
  openai: "oklch(0.70 0.15 160)",
  anthropic: "oklch(0.70 0.18 290)",
  kimi: "oklch(0.65 0.18 250)",
  deepseek: "oklch(0.65 0.20 220)",
  custom: "oklch(0.65 0.10 240)",
};

type TestStatus = "idle" | "testing" | "ok" | "error";

// Fal.ai API Key 配置卡片
function FalApiKeyCard() {
  const { data: falStatus, refetch } = trpc.apiSettings.getFalKeyStatus.useQuery();
  const saveFalKey = trpc.apiSettings.saveFalKey.useMutation();
  const [falKey, setFalKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const handleSave = async () => {
    try {
      await saveFalKey.mutateAsync({ falApiKey: falKey });
      toast.success("Fal.ai API Key 已保存");
      setFalKey("");
      setIsDirty(false);
      refetch();
    } catch (e: unknown) {
      toast.error("保存失败：" + (e instanceof Error ? e.message : "未知错误"));
    }
  };

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: "oklch(0.16 0.006 240)", border: "1px solid oklch(0.25 0.008 240)" }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">🎬</span>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: "oklch(0.90 0.005 60)", fontFamily: "'Space Grotesk', sans-serif" }}>Fal.ai 视频生成</h3>
            <p className="text-xs" style={{ color: "oklch(0.55 0.01 240)" }}>Seedance 1.5 图生视频（出海短剧工作流）</p>
          </div>
        </div>
        <span className="text-xs px-2 py-1 rounded font-mono" style={{
          background: falStatus?.configured ? "oklch(0.65 0.20 145 / 0.15)" : "oklch(0.30 0.01 240)",
          color: falStatus?.configured ? "oklch(0.65 0.20 145)" : "oklch(0.55 0.01 240)",
          border: `1px solid ${falStatus?.configured ? "oklch(0.65 0.20 145 / 0.30)" : "oklch(0.30 0.01 240)"}`
        }}>
          {falStatus?.configured ? "✓ 已配置" : "未配置"}
        </span>
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type={showKey ? "text" : "password"}
            value={falKey}
            onChange={e => { setFalKey(e.target.value); setIsDirty(true); }}
            placeholder={falStatus?.configured ? "已配置，输入新 Key 可更新" : "输入 fal.ai API Key"}
            style={{ background: "oklch(0.14 0.005 240)", border: "1px solid oklch(0.28 0.008 240)", color: "oklch(0.88 0.005 60)", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, paddingRight: 36 }}
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2"
            style={{ color: "oklch(0.50 0.01 240)" }}
          >
            <Key size={14} />
          </button>
        </div>
        <Button
          onClick={handleSave}
          disabled={!isDirty || !falKey || saveFalKey.isPending}
          style={{ background: isDirty && falKey ? "oklch(0.75 0.17 65)" : "oklch(0.25 0.008 240)", color: isDirty && falKey ? "oklch(0.1 0.005 240)" : "oklch(0.45 0.01 240)", fontWeight: 600, gap: 6 }}
        >
          {saveFalKey.isPending ? <Loader2 size={14} className="animate-spin" /> : <Settings size={14} />}
          保存
        </Button>
      </div>
      <div className="flex items-start gap-2 px-3 py-2 rounded-lg" style={{ background: "oklch(0.75 0.17 65 / 0.06)", border: "1px solid oklch(0.75 0.17 65 / 0.15)" }}>
        <Info size={12} style={{ color: "oklch(0.75 0.17 65)", marginTop: 1, flexShrink: 0 }} />
        <p className="text-xs leading-relaxed" style={{ color: "oklch(0.65 0.01 240)" }}>
          在{" "}
          <a href="https://fal.ai/dashboard/keys" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "oklch(0.65 0.15 200)" }}>fal.ai/dashboard/keys</a>
          {" "}获取免费 API Key，配置后可在出海短剧工作流中使用 Seedance 1.5 生成视频。
        </p>
      </div>
    </div>
  );
}

// Veo 3.1 配置状态卡片
function Veo31StatusCard() {
  const { data: apiData } = trpc.apiSettings.get.useQuery();
  const isGeminiConfigured = apiData?.setting?.provider === "gemini" && !!apiData?.setting?.apiKey;
  const isGeminiProvider = apiData?.setting?.provider === "gemini";

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: "oklch(0.16 0.006 240)", border: "1px solid oklch(0.25 0.008 240)" }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">⚡</span>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: "oklch(0.90 0.005 60)", fontFamily: "'Space Grotesk', sans-serif" }}>Veo 3.1 视频生成</h3>
            <p className="text-xs" style={{ color: "oklch(0.55 0.01 240)" }}>Google Veo 3.1 首尾帧模式（出海短剧工作流）</p>
          </div>
        </div>
        <span className="text-xs px-2 py-1 rounded font-mono" style={{
          background: isGeminiConfigured ? "oklch(0.65 0.20 145 / 0.15)" : "oklch(0.30 0.01 240)",
          color: isGeminiConfigured ? "oklch(0.65 0.20 145)" : "oklch(0.55 0.01 240)",
          border: `1px solid ${isGeminiConfigured ? "oklch(0.65 0.20 145 / 0.30)" : "oklch(0.30 0.01 240)"}`
        }}>
          {isGeminiConfigured ? "✓ 已配置" : "未配置"}
        </span>
      </div>
      <div className="flex items-start gap-2 px-3 py-2 rounded-lg" style={{ background: isGeminiConfigured ? "oklch(0.65 0.20 145 / 0.06)" : "oklch(0.75 0.17 65 / 0.06)", border: `1px solid ${isGeminiConfigured ? "oklch(0.65 0.20 145 / 0.15)" : "oklch(0.75 0.17 65 / 0.15)"}` }}>
        <Info size={12} style={{ color: isGeminiConfigured ? "oklch(0.65 0.20 145)" : "oklch(0.75 0.17 65)", marginTop: 1, flexShrink: 0 }} />
        <p className="text-xs leading-relaxed" style={{ color: "oklch(0.65 0.01 240)" }}>
          {isGeminiConfigured
            ? `Veo 3.1 已就绪，当前使用 Gemini 提供商的 API Key。在出海短剧工作流视频生成面板中选择「Veo 3.1」即可使用。`
            : isGeminiProvider
              ? `当前已选择 Gemini 提供商，但还未配置 API Key。请在上方输入 Gemini API Key 并保存。`
              : `Veo 3.1 需要 Gemini API Key。请在上方将提供商切换为「Google Gemini」并配置 API Key。`
          }
        </p>
      </div>
      {!isGeminiConfigured && (
        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs underline block"
          style={{ color: "oklch(0.65 0.15 200)" }}
        >
          在 Google AI Studio 获取免费 Gemini API Key →
        </a>
      )}
    </div>
  );
}

export default function ApiSettingsPage() {
  const { data, isLoading, refetch } = trpc.apiSettings.get.useQuery();
  const saveMutation = trpc.apiSettings.save.useMutation();
  const testMutation = trpc.apiSettings.test.useMutation();

  const [selectedProvider, setSelectedProvider] = useState("gemini");
  const [selectedModel, setSelectedModel] = useState("gemini-3-flash-preview");
  const [apiKey, setApiKey] = useState("");
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [testMessage, setTestMessage] = useState("");
  const [testLatency, setTestLatency] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // 从服务器加载已保存的设置
  useEffect(() => {
    if (data?.setting) {
      setSelectedProvider(data.setting.provider);
      setSelectedModel(data.setting.model);
      setApiKey(data.setting.apiKey || "");
      setApiBaseUrl(data.setting.apiBaseUrl || "");
      if (data.setting.lastTestStatus === "ok") setTestStatus("ok");
      else if (data.setting.lastTestStatus === "error") setTestStatus("error");
    }
  }, [data]);

  const providers = (data?.providers ?? {}) as Record<string, { name: string; baseUrl: string; models: { id: string; name: string }[] }>;
  const currentProvider = providers[selectedProvider];
  const models = currentProvider?.models ?? [];

  const handleProviderChange = (providerKey: string) => {
    setSelectedProvider(providerKey);
    const p = providers[providerKey as keyof typeof providers];
    if (p && p.models.length > 0) {
      setSelectedModel(p.models[0].id);
    } else {
      setSelectedModel("");
    }
    setApiBaseUrl((providers[providerKey as keyof typeof providers] as { baseUrl: string })?.baseUrl || "");
    setIsDirty(true);
    setTestStatus("idle");
  };

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync({
        provider: selectedProvider,
        model: selectedModel,
        apiKey: apiKey || undefined,
        apiBaseUrl: apiBaseUrl || undefined,
      });
      toast.success("API 设置已保存");
      setIsDirty(false);
      refetch();
    } catch (e: unknown) {
      toast.error("保存失败：" + (e instanceof Error ? e.message : "未知错误"));
    }
  };

  const handleTest = async () => {
    setTestStatus("testing");
    setTestMessage("");
    try {
      const result = await testMutation.mutateAsync({
        provider: selectedProvider,
        model: selectedModel,
        apiKey: apiKey || undefined,
        apiBaseUrl: apiBaseUrl || undefined,
      });
      setTestStatus(result.status);
      setTestMessage(result.message);
      setTestLatency(result.latencyMs);
      if (result.status === "ok") {
        toast.success("API 连接测试成功");
      } else {
        toast.error("API 连接测试失败");
      }
    } catch (e: unknown) {
      setTestStatus("error");
      setTestMessage(e instanceof Error ? e.message : "测试失败");
      toast.error("测试请求出错");
    }
  };

  const getStatusIcon = () => {
    if (testStatus === "testing") return <Loader2 className="w-4 h-4 animate-spin" style={{ color: "oklch(0.75 0.17 65)" }} />;
    if (testStatus === "ok") return <CheckCircle2 className="w-4 h-4" style={{ color: "oklch(0.65 0.20 145)" }} />;
    if (testStatus === "error") return <XCircle className="w-4 h-4" style={{ color: "oklch(0.65 0.20 20)" }} />;
    return <Wifi className="w-4 h-4" style={{ color: "oklch(0.50 0.01 240)" }} />;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "oklch(0.13 0.005 240)" }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "oklch(0.75 0.17 65)" }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "oklch(0.13 0.005 240)" }}>
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center gap-4"
        style={{ borderColor: "oklch(0.22 0.006 240)", background: "oklch(0.12 0.005 240)" }}>
        <Link href="/">
          <button className="flex items-center gap-2 px-3 py-1.5 rounded transition-colors"
            style={{ color: "oklch(0.65 0.01 240)", background: "oklch(0.18 0.006 240)", border: "1px solid oklch(0.25 0.008 240)" }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = "oklch(0.75 0.17 65 / 0.4)")}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "oklch(0.25 0.008 240)")}>
            <ArrowLeft size={14} />
            <span className="text-xs" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>返回</span>
          </button>
        </Link>
        <div className="flex items-center gap-2">
          <Settings size={16} style={{ color: "oklch(0.75 0.17 65)" }} />
          <h1 className="text-sm font-bold" style={{ color: "oklch(0.92 0.005 60)", fontFamily: "'Space Grotesk', sans-serif" }}>
            AI 模型设置
          </h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {isDirty && (
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: "oklch(0.75 0.17 65 / 0.15)", color: "oklch(0.75 0.17 65)", fontFamily: "'JetBrains Mono', monospace" }}>
              未保存
            </span>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* 当前状态卡片 */}
        <div className="rounded-xl p-4 flex items-center gap-4"
          style={{ background: "oklch(0.16 0.006 240)", border: "1px solid oklch(0.25 0.008 240)" }}>
          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
            style={{ background: "oklch(0.20 0.008 240)" }}>
            {PROVIDER_ICONS[selectedProvider] || "⚙️"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-semibold" style={{ color: "oklch(0.90 0.005 60)", fontFamily: "'Space Grotesk', sans-serif" }}>
                {currentProvider?.name || selectedProvider}
              </span>
              <span className="text-xs px-2 py-0.5 rounded font-mono"
                style={{ background: "oklch(0.20 0.008 240)", color: "oklch(0.65 0.01 240)" }}>
                {selectedModel || "未选择"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <span className="text-xs" style={{ color: "oklch(0.60 0.01 240)", fontFamily: "'JetBrains Mono', monospace" }}>
                {testStatus === "idle" && "未测试"}
                {testStatus === "testing" && "测试中..."}
                {testStatus === "ok" && `连接正常 · ${testLatency}ms`}
                {testStatus === "error" && "连接失败"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleTest}
              disabled={testStatus === "testing"}
              style={{ borderColor: "oklch(0.30 0.008 240)", color: "oklch(0.70 0.01 240)", background: "transparent", gap: 6 }}>
              {testStatus === "testing" ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
              测试连接
            </Button>
          </div>
        </div>

        {/* 测试结果提示 */}
        {testMessage && (
          <div className="rounded-lg px-4 py-3 flex items-start gap-3"
            style={{
              background: testStatus === "ok" ? "oklch(0.65 0.20 145 / 0.10)" : "oklch(0.65 0.20 20 / 0.10)",
              border: `1px solid ${testStatus === "ok" ? "oklch(0.65 0.20 145 / 0.30)" : "oklch(0.65 0.20 20 / 0.30)"}`,
            }}>
            {testStatus === "ok"
              ? <CheckCircle2 size={15} style={{ color: "oklch(0.65 0.20 145)", marginTop: 1, flexShrink: 0 }} />
              : <XCircle size={15} style={{ color: "oklch(0.65 0.20 20)", marginTop: 1, flexShrink: 0 }} />}
            <span className="text-xs leading-relaxed" style={{ color: "oklch(0.75 0.01 240)", fontFamily: "'JetBrains Mono', monospace" }}>
              {testMessage}
            </span>
          </div>
        )}

        {/* 提供商选择 */}
        <div className="space-y-3">
          <label className="text-xs tracking-widest uppercase" style={{ color: "oklch(0.50 0.01 240)", fontFamily: "'JetBrains Mono', monospace" }}>
            AI 提供商
          </label>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(providers).map(([key, provider]) => (
              <button
                key={key}
                onClick={() => handleProviderChange(key)}
                className="flex flex-col items-center gap-2 p-3 rounded-lg transition-all duration-200"
                              style={{ background: selectedProvider === key ? "oklch(0.20 0.008 240)" : "oklch(0.16 0.006 240)",
                    border: `1px solid ${selectedProvider === key ? (PROVIDER_COLORS[key] ?? "oklch(0.75 0.17 65)") : "oklch(0.25 0.008 240)"}`,
                    boxShadow: selectedProvider === key ? `0 0 12px ${PROVIDER_COLORS[key] ?? "oklch(0.75 0.17 65)"}20` : "none",
                  }}>               <span className="text-xl">{PROVIDER_ICONS[key] || "⚙️"}</span>
                <span className="text-xs font-medium text-center leading-tight"
                  style={{ color: selectedProvider === key ? "oklch(0.90 0.005 60)" : "oklch(0.60 0.01 240)", fontFamily: "'Space Grotesk', sans-serif" }}>
                  {provider.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 模型选择 */}
        <div className="space-y-3">
          <label className="text-xs tracking-widest uppercase" style={{ color: "oklch(0.50 0.01 240)", fontFamily: "'JetBrains Mono', monospace" }}>
            模型
          </label>
          {selectedProvider === "custom" ? (
            <Input
              value={selectedModel}
              onChange={e => { setSelectedModel(e.target.value); setIsDirty(true); }}
              placeholder="输入模型名称，如 gpt-4o"
              style={{ background: "oklch(0.16 0.006 240)", border: "1px solid oklch(0.28 0.008 240)", color: "oklch(0.88 0.005 60)", fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}
            />
          ) : (
            <div className="space-y-1">
              {models.map((m: { id: string; name: string }) => (
                <button
                  key={m.id}
                  onClick={() => { setSelectedModel(m.id); setIsDirty(true); }}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200"
                  style={{
                    background: selectedModel === m.id ? "oklch(0.20 0.008 240)" : "oklch(0.16 0.006 240)",
                    border: `1px solid ${selectedModel === m.id ? "oklch(0.75 0.17 65 / 0.5)" : "oklch(0.25 0.008 240)"}`,
                  }}>
                  <span className="text-sm" style={{ color: selectedModel === m.id ? "oklch(0.90 0.005 60)" : "oklch(0.65 0.01 240)", fontFamily: "'Space Grotesk', sans-serif" }}>
                    {m.name}
                  </span>
                  <span className="text-xs font-mono" style={{ color: "oklch(0.45 0.008 240)" }}>
                    {m.id}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* API Key */}
        <div className="space-y-3">
          <label className="text-xs tracking-widest uppercase flex items-center gap-2" style={{ color: "oklch(0.50 0.01 240)", fontFamily: "'JetBrains Mono', monospace" }}>
            <Key size={11} />
            API Key
            <span className="text-[10px] normal-case tracking-normal px-1.5 py-0.5 rounded"
              style={{ background: "oklch(0.20 0.008 240)", color: "oklch(0.55 0.01 240)" }}>
              可选 · 留空使用系统默认
            </span>
          </label>
          <Input
            type="password"
            value={apiKey}
            onChange={e => { setApiKey(e.target.value); setIsDirty(true); }}
            placeholder={`输入你的 ${currentProvider?.name || ""} API Key`}
            style={{ background: "oklch(0.16 0.006 240)", border: "1px solid oklch(0.28 0.008 240)", color: "oklch(0.88 0.005 60)", fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}
          />
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg"
            style={{ background: "oklch(0.75 0.17 65 / 0.06)", border: "1px solid oklch(0.75 0.17 65 / 0.15)" }}>
            <Info size={12} style={{ color: "oklch(0.75 0.17 65)", marginTop: 1, flexShrink: 0 }} />
            <p className="text-xs leading-relaxed" style={{ color: "oklch(0.65 0.01 240)" }}>
              留空时使用系统内置 AI（所有用户共享配额）。填写自己的 Key 可使用更强的模型，且不占用系统配额。
            </p>
          </div>
        </div>

        {/* 高级设置（折叠） */}
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid oklch(0.25 0.008 240)" }}>
          <button
            className="w-full flex items-center justify-between px-4 py-3 transition-colors"
            style={{ background: "oklch(0.16 0.006 240)", color: "oklch(0.65 0.01 240)" }}
            onClick={() => setShowAdvanced(!showAdvanced)}>
            <div className="flex items-center gap-2">
              <Globe size={13} />
              <span className="text-xs" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>高级设置（自定义 API 地址）</span>
            </div>
            {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showAdvanced && (
            <div className="px-4 pb-4 pt-3 space-y-3" style={{ background: "oklch(0.14 0.005 240)" }}>
              <label className="text-xs tracking-widest uppercase" style={{ color: "oklch(0.50 0.01 240)", fontFamily: "'JetBrains Mono', monospace" }}>
                API Base URL
              </label>
              <Input
                value={apiBaseUrl}
                onChange={e => { setApiBaseUrl(e.target.value); setIsDirty(true); }}
                placeholder={`默认: ${currentProvider?.baseUrl || "自动"}`}
                style={{ background: "oklch(0.16 0.006 240)", border: "1px solid oklch(0.28 0.008 240)", color: "oklch(0.88 0.005 60)", fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}
              />
              <p className="text-xs" style={{ color: "oklch(0.50 0.01 240)" }}>
                用于代理服务或本地部署的 OpenAI 兼容模型（如 Ollama、LM Studio）
              </p>
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            onClick={handleTest}
            disabled={testStatus === "testing"}
            variant="outline"
            style={{ borderColor: "oklch(0.30 0.008 240)", color: "oklch(0.70 0.01 240)", background: "transparent", gap: 6, flex: 1 }}>
            {testStatus === "testing" ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            {testStatus === "testing" ? "测试中..." : "测试 API 连接"}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending || !isDirty}
            style={{ background: isDirty ? "oklch(0.75 0.17 65)" : "oklch(0.30 0.008 240)", color: isDirty ? "oklch(0.1 0.005 240)" : "oklch(0.50 0.01 240)", fontWeight: 600, gap: 6, flex: 1 }}>
            {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Settings size={14} />}
            {saveMutation.isPending ? "保存中..." : isDirty ? "保存设置" : "已保存"}
          </Button>
        </div>

        {/* Fal.ai 视频生成配置 */}
        <FalApiKeyCard />
        {/* Veo 3.1 配置状态 */}
        <Veo31StatusCard />

        {/* 说明区域 */}
        <div className="rounded-xl p-4 space-y-3" style={{ background: "oklch(0.16 0.006 240)", border: "1px solid oklch(0.25 0.008 240)" }}>
          <h3 className="text-xs font-semibold tracking-widest uppercase" style={{ color: "oklch(0.55 0.01 240)", fontFamily: "'JetBrains Mono', monospace" }}>
            各提供商获取 API Key
          </h3>
          <div className="space-y-2">
            {[
              { name: "Google Gemini", url: "https://aistudio.google.com/apikey", note: "免费额度充足，推荐首选" },
              { name: "OpenAI", url: "https://platform.openai.com/api-keys", note: "GPT-4o 质量高，按量计费" },
              { name: "Anthropic Claude", url: "https://console.anthropic.com/", note: "长文本理解能力强" },
              { name: "Kimi (月之暗面)", url: "https://platform.moonshot.cn/", note: "中文优化，国内访问稳定" },
              { name: "DeepSeek", url: "https://platform.deepseek.com/", note: "性价比极高，推理能力强" },
            ].map(item => (
              <div key={item.name} className="flex items-center gap-3">
                <a href={item.url} target="_blank" rel="noopener noreferrer"
                  className="text-xs hover:underline flex-shrink-0"
                  style={{ color: "oklch(0.65 0.15 200)", fontFamily: "'Space Grotesk', sans-serif" }}>
                  {item.name} →
                </a>
                <span className="text-xs" style={{ color: "oklch(0.50 0.01 240)" }}>{item.note}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 成本参考 */}
        <div className="rounded-xl p-4" style={{ background: "oklch(0.16 0.006 240)", border: "1px solid oklch(0.25 0.008 240)" }}>
          <h3 className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: "oklch(0.55 0.01 240)", fontFamily: "'JetBrains Mono', monospace" }}>
            成本参考（每集 AI 生成）
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "剧本解析", cost: "~0.02 元" },
              { label: "人物 MJ 提示词 (×5)", cost: "~0.10 元" },
              { label: "场景 MJ 提示词 (×5)", cost: "~0.10 元" },
              { label: "道具 MJ 提示词 (×5)", cost: "~0.10 元" },
              { label: "分镜生成 (20-30 镜)", cost: "~0.30 元" },
              { label: "视频提示词生成", cost: "~0.20 元" },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between px-3 py-2 rounded-lg"
                style={{ background: "oklch(0.13 0.005 240)" }}>
                <span className="text-xs" style={{ color: "oklch(0.60 0.01 240)" }}>{item.label}</span>
                <span className="text-xs font-mono font-bold" style={{ color: "oklch(0.75 0.17 65)" }}>{item.cost}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 flex items-center justify-between" style={{ borderTop: "1px solid oklch(0.22 0.006 240)" }}>
            <span className="text-xs font-semibold" style={{ color: "oklch(0.70 0.01 240)", fontFamily: "'Space Grotesk', sans-serif" }}>
              每集合计（AI 生成）
            </span>
            <span className="text-sm font-bold font-mono" style={{ color: "oklch(0.75 0.17 65)" }}>≈ 1.5 ~ 2 元</span>
          </div>
        </div>

        {/* 最后测试时间 */}
        {data?.setting?.lastTestedAt && (
          <div className="flex items-center gap-2 text-xs" style={{ color: "oklch(0.45 0.008 240)", fontFamily: "'JetBrains Mono', monospace" }}>
            <Clock size={11} />
            上次测试：{new Date(data.setting.lastTestedAt).toLocaleString("zh-CN")}
            {data.setting.lastTestStatus === "ok"
              ? <CheckCircle2 size={11} style={{ color: "oklch(0.65 0.20 145)" }} />
              : <WifiOff size={11} style={{ color: "oklch(0.65 0.20 20)" }} />}
          </div>
        )}
      </div>
    </div>
  );
}
