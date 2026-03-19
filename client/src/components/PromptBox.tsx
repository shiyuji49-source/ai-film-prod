// DESIGN: "导演手册" 工业风暗色系
// Prompt output box with copy functionality and typewriter animation
import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PromptBoxProps {
  label?: string;
  content: string;
  lang?: "zh" | "en";
  className?: string;
}

export default function PromptBox({ label, content, lang = "zh", className }: PromptBoxProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!content.trim()) return;
    await navigator.clipboard.writeText(content);
    setCopied(true);
    toast.success("提示词已复制到剪贴板");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("rounded overflow-hidden", className)}
      style={{ border: "1px solid oklch(0.28 0.008 240)" }}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-2"
        style={{ background: "oklch(0.15 0.006 240)", borderBottom: "1px solid oklch(0.28 0.008 240)" }}>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: "oklch(0.55 0.2 25)" }} />
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: "oklch(0.7 0.18 85)" }} />
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: "oklch(0.65 0.2 145)" }} />
          </div>
          <span className="text-[10px] tracking-widest uppercase"
            style={{ color: "oklch(0.45 0.008 240)", fontFamily: "'JetBrains Mono', monospace" }}>
            {label || (lang === "zh" ? "中文提示词" : "English Prompt")}
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-all duration-200"
          style={{
            background: copied ? "oklch(0.65 0.2 145 / 0.2)" : "oklch(0.22 0.006 240)",
            color: copied ? "oklch(0.65 0.2 145)" : "oklch(0.60 0.01 240)",
            border: `1px solid ${copied ? "oklch(0.65 0.2 145 / 0.4)" : "oklch(0.28 0.008 240)"}`,
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? "已复制" : "复制"}
        </button>
      </div>
      {/* Content */}
      <pre className="p-4 text-xs leading-relaxed whitespace-pre-wrap break-words overflow-x-auto"
        style={{
          background: "oklch(0.10 0.004 240)",
          color: content.trim() ? "oklch(0.85 0.005 60)" : "oklch(0.40 0.008 240)",
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          minHeight: "80px",
          borderLeft: "3px solid oklch(0.75 0.17 65)",
        }}>
        {content.trim() || "// 填写上方信息后，点击「生成提示词」按钮"}
      </pre>
    </div>
  );
}
