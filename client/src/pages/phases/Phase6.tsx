// DESIGN: "导演手册" 工业风暗色系 — Phase 6: Reference Library
import { MOOD_KEYWORDS, LIGHTING_TYPES } from "@/lib/workflowData";
import { useProject } from "@/contexts/ProjectContext";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function CopyTag({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("已复制");
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={handleCopy}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-all"
      style={{
        background: copied ? "oklch(0.65 0.2 145 / 0.15)" : "oklch(0.22 0.006 240)",
        border: `1px solid ${copied ? "oklch(0.65 0.2 145 / 0.4)" : "oklch(0.28 0.008 240)"}`,
        color: copied ? "oklch(0.65 0.2 145)" : "oklch(0.60 0.01 240)",
        fontFamily: "'JetBrains Mono', monospace",
      }}>
      {copied ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
      {text}
    </button>
  );
}

export default function Phase6() {
  const { markPhaseComplete } = useProject();

  const handleComplete = () => {
    markPhaseComplete("phase6");
  };

  return (
    <div className="space-y-8">
      {/* Phase header */}
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-12 h-12 rounded flex items-center justify-center text-lg font-bold"
          style={{ background: "oklch(0.75 0.17 65 / 0.15)", border: "1px solid oklch(0.75 0.17 65 / 0.4)", color: "oklch(0.75 0.17 65)", fontFamily: "'JetBrains Mono', monospace" }}>
          06
        </div>
        <div>
          <h2 className="text-xl font-bold" style={{ color: "oklch(0.92 0.005 60)", fontFamily: "'Space Grotesk', sans-serif" }}>
            参考素材库
          </h2>
          <p className="text-sm mt-1" style={{ color: "oklch(0.55 0.01 240)" }}>
            情绪关键词、光影描述等常用创作素材 — 点击标签即可复制
          </p>
        </div>
      </div>

      {/* Mood keywords */}
      <section>
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"
          style={{ color: "oklch(0.75 0.17 65)", fontFamily: "'Space Grotesk', sans-serif" }}>
          <span className="step-badge px-2 py-0.5 rounded text-[10px]"
            style={{ background: "oklch(0.75 0.17 65 / 0.15)", border: "1px solid oklch(0.75 0.17 65 / 0.3)" }}>
            A
          </span>
          常用情绪关键词
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "1px solid oklch(0.28 0.008 240)" }}>
                {["中文关键词", "English", "适用场景"].map(h => (
                  <th key={h} className="text-left py-2 px-3 font-semibold"
                    style={{ color: "oklch(0.75 0.17 65)", fontFamily: "'Space Grotesk', sans-serif" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOOD_KEYWORDS.map((m, i) => (
                <tr key={i} style={{ borderBottom: "1px solid oklch(0.22 0.006 240)" }}>
                  <td className="py-2 px-3">
                    <CopyTag text={m.zh} />
                  </td>
                  <td className="py-2 px-3">
                    <CopyTag text={m.en} />
                  </td>
                  <td className="py-2 px-3" style={{ color: "oklch(0.55 0.01 240)" }}>{m.scene}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Lighting types */}
      <section>
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"
          style={{ color: "oklch(0.75 0.17 65)", fontFamily: "'Space Grotesk', sans-serif" }}>
          <span className="step-badge px-2 py-0.5 rounded text-[10px]"
            style={{ background: "oklch(0.75 0.17 65 / 0.15)", border: "1px solid oklch(0.75 0.17 65 / 0.3)" }}>
            B
          </span>
          常用光影描述
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {LIGHTING_TYPES.map(l => (
            <div key={l.name} className="p-3 rounded"
              style={{ background: "oklch(0.17 0.006 240)", border: "1px solid oklch(0.28 0.008 240)" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold" style={{ color: "oklch(0.85 0.005 60)", fontFamily: "'Space Grotesk', sans-serif" }}>
                  {l.name}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <CopyTag text={l.zh} />
                <CopyTag text={l.en} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Seedance segmentation guide */}
      <section>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"
          style={{ color: "oklch(0.75 0.17 65)", fontFamily: "'Space Grotesk', sans-serif" }}>
          <span className="step-badge px-2 py-0.5 rounded text-[10px]"
            style={{ background: "oklch(0.75 0.17 65 / 0.15)", border: "1px solid oklch(0.75 0.17 65 / 0.3)" }}>
            C
          </span>
          Seedance 分段策略速查
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "1px solid oklch(0.28 0.008 240)" }}>
                {["段落内镜头数", "适合场景", "建议时长"].map(h => (
                  <th key={h} className="text-left py-2 px-3 font-semibold"
                    style={{ color: "oklch(0.75 0.17 65)", fontFamily: "'Space Grotesk', sans-serif" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { shots: "2-3个镜头", scene: "节奏慢的对话/情感", duration: "10-12s" },
                { shots: "3-4个镜头", scene: "中等节奏的叙事", duration: "12-13s" },
                { shots: "4-5个镜头", scene: "快节奏战斗/蒙太奇", duration: "13-15s" },
              ].map((r, i) => (
                <tr key={i} style={{ borderBottom: "1px solid oklch(0.22 0.006 240)" }}>
                  <td className="py-2 px-3 font-medium" style={{ color: "oklch(0.85 0.005 60)" }}>{r.shots}</td>
                  <td className="py-2 px-3" style={{ color: "oklch(0.65 0.01 240)" }}>{r.scene}</td>
                  <td className="py-2 px-3" style={{ color: "oklch(0.75 0.17 65)", fontFamily: "'JetBrains Mono', monospace" }}>{r.duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs mt-3 px-1" style={{ color: "oklch(0.50 0.01 240)" }}>
          一分钟视频 = 4-6 个 Seedance 片段 · 总计 20-30 个镜头 · 根据不同类型和具体画面灵活调整
        </p>
      </section>

      <div className="flex justify-end pt-2">
        <Button onClick={handleComplete} className="flex items-center gap-2 px-6"
          style={{ background: "oklch(0.75 0.17 65)", color: "oklch(0.1 0.005 240)", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600 }}>
          <CheckCircle2 className="w-4 h-4" />
          完成所有阶段
        </Button>
      </div>
    </div>
  );
}
