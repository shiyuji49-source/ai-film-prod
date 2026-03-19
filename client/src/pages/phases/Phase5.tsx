// DESIGN: "导演手册" 工业风暗色系 — Phase 5: Generation & Post
import { useProject } from "@/contexts/ProjectContext";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ChevronRight } from "lucide-react";

const WORKFLOW_STEPS_DETAIL = [
  {
    num: "01",
    tool: "Midjourney",
    title: "风格探索",
    desc: "不追求细节，快速生成大量图片，探索并确定最符合项目气质的角色、场景、光影的整体风格方向。",
    color: "oklch(0.65 0.18 280)",
  },
  {
    num: "02",
    tool: "Gemini 3 Pro Image",
    title: "核心资产生成",
    desc: "使用确定的风格，生成高精度、细节统一的角色主图与三视图，以及多角度场景参考图。这是保证全片一致性的关键资产锚点。",
    color: "oklch(0.75 0.17 65)",
  },
  {
    num: "03",
    tool: "即梦 / Seedance 1.5 Pro",
    title: "视频片段生成",
    desc: "使用「全能参考模式」：将角色三视图作为图像参考，配合多镜头提示词，生成包含旁白、音效的视频片段。",
    color: "oklch(0.65 0.2 145)",
  },
  {
    num: "04",
    tool: "剪映 / Premiere",
    title: "后期剪辑",
    desc: "将所有生成的视频片段按分镜表顺序拼接、精剪，调整节奏与转场。",
    color: "oklch(0.65 0.2 25)",
  },
  {
    num: "05",
    tool: "终混工具",
    title: "终混与交付",
    desc: "添加背景音乐（BGM），进行整体调色，添加字幕、标题卡等包装元素，最终输出成片。",
    color: "oklch(0.60 0.15 200)",
  },
];

const CONSISTENCY_TIPS = [
  { key: "① 资产锚定 (最关键)", desc: "必须使用由 Gemini 3 Pro Image 生成的同一张角色三视图作为所有相关镜头的图像参考。" },
  { key: "② 文本复述", desc: "在每一条视频提示词中，都用相同的核心外貌关键词（如「白发红瞳法师」）来文字性地「提醒」AI。" },
  { key: "③ 风格锁定", desc: "在所有提示词的末尾，都使用完全相同的风格标签。" },
  { key: "④ 批量筛选", desc: "针对关键镜头，可生成3-5个版本，从中挑选出与参考图最接近、动态最流畅的一个。" },
];

const TRANSITION_TYPES = [
  { name: "硬切", scene: "同场景不同角度", tip: "直接切换，无需描述" },
  { name: "淡入淡出", scene: "时间流逝、场景转换", tip: "「画面渐暗/渐亮」" },
  { name: "白光过渡", scene: "爆炸、能量爆发后", tip: "「白光吞噬画面，过渡为纯白」" },
  { name: "黑屏过渡", scene: "情绪转折、章节分隔", tip: "「画面渐暗至全黑」" },
  { name: "匹配剪辑", scene: "两个相似形状/动作间", tip: "A镜头某物 → B镜头类似物" },
  { name: "甩镜/快摇", scene: "快节奏、紧张感", tip: "「镜头快速横摇模糊」" },
];

export default function Phase5() {
  const { markPhaseComplete, setActivePhase } = useProject();

  const handleComplete = () => {
    markPhaseComplete("phase5");
    setActivePhase("phase6");
  };

  return (
    <div className="space-y-8">
      {/* Phase header */}
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-12 h-12 rounded flex items-center justify-center text-lg font-bold"
          style={{ background: "oklch(0.75 0.17 65 / 0.15)", border: "1px solid oklch(0.75 0.17 65 / 0.4)", color: "oklch(0.75 0.17 65)", fontFamily: "'JetBrains Mono', monospace" }}>
          05
        </div>
        <div>
          <h2 className="text-xl font-bold" style={{ color: "oklch(0.92 0.005 60)", fontFamily: "'Space Grotesk', sans-serif" }}>
            生成与后期
          </h2>
          <p className="text-sm mt-1" style={{ color: "oklch(0.55 0.01 240)" }}>
            按工作流生成视频片段，完成剪辑、终混与交付
          </p>
        </div>
      </div>

      {/* Workflow pipeline */}
      <section>
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"
          style={{ color: "oklch(0.75 0.17 65)", fontFamily: "'Space Grotesk', sans-serif" }}>
          <span className="step-badge px-2 py-0.5 rounded text-[10px]"
            style={{ background: "oklch(0.75 0.17 65 / 0.15)", border: "1px solid oklch(0.75 0.17 65 / 0.3)" }}>
            5.1
          </span>
          推荐生成流程
        </h3>
        <div className="space-y-2">
          {WORKFLOW_STEPS_DETAIL.map((step, idx) => (
            <div key={step.num} className="flex items-start gap-4">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: `${step.color} / 0.15`, border: `1px solid ${step.color} / 0.4`, color: step.color, fontFamily: "'JetBrains Mono', monospace" }}>
                  {step.num}
                </div>
                {idx < WORKFLOW_STEPS_DETAIL.length - 1 && (
                  <div className="w-px flex-1 my-1" style={{ background: "oklch(0.28 0.008 240)", minHeight: "16px" }} />
                )}
              </div>
              <div className="flex-1 pb-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs px-2 py-0.5 rounded font-medium"
                    style={{ background: "oklch(0.22 0.006 240)", color: step.color, fontFamily: "'JetBrains Mono', monospace" }}>
                    {step.tool}
                  </span>
                  <span className="text-sm font-semibold" style={{ color: "oklch(0.88 0.005 60)", fontFamily: "'Space Grotesk', sans-serif" }}>
                    {step.title}
                  </span>
                </div>
                <p className="text-xs" style={{ color: "oklch(0.58 0.01 240)" }}>{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Consistency tips */}
      <section>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"
          style={{ color: "oklch(0.75 0.17 65)", fontFamily: "'Space Grotesk', sans-serif" }}>
          <span className="step-badge px-2 py-0.5 rounded text-[10px]"
            style={{ background: "oklch(0.75 0.17 65 / 0.15)", border: "1px solid oklch(0.75 0.17 65 / 0.3)" }}>
            5.2
          </span>
          角色一致性保持技巧
        </h3>
        <div className="space-y-2">
          {CONSISTENCY_TIPS.map(tip => (
            <div key={tip.key} className="p-3 rounded flex gap-3"
              style={{ background: "oklch(0.17 0.006 240)", border: "1px solid oklch(0.28 0.008 240)" }}>
              <div className="flex-shrink-0 w-1 rounded-full self-stretch" style={{ background: "oklch(0.75 0.17 65)" }} />
              <div>
                <div className="text-xs font-semibold mb-0.5" style={{ color: "oklch(0.85 0.005 60)", fontFamily: "'Space Grotesk', sans-serif" }}>
                  {tip.key}
                </div>
                <div className="text-xs" style={{ color: "oklch(0.55 0.01 240)" }}>{tip.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Transition types */}
      <section>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"
          style={{ color: "oklch(0.75 0.17 65)", fontFamily: "'Space Grotesk', sans-serif" }}>
          <span className="step-badge px-2 py-0.5 rounded text-[10px]"
            style={{ background: "oklch(0.75 0.17 65 / 0.15)", border: "1px solid oklch(0.75 0.17 65 / 0.3)" }}>
            5.3
          </span>
          转场类型建议
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "1px solid oklch(0.28 0.008 240)" }}>
                {["转场方式", "适用场景", "提示词写法"].map(h => (
                  <th key={h} className="text-left py-2 px-3 font-semibold"
                    style={{ color: "oklch(0.75 0.17 65)", fontFamily: "'Space Grotesk', sans-serif" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TRANSITION_TYPES.map((t, i) => (
                <tr key={i} style={{ borderBottom: "1px solid oklch(0.22 0.006 240)" }}>
                  <td className="py-2 px-3 font-medium" style={{ color: "oklch(0.85 0.005 60)" }}>{t.name}</td>
                  <td className="py-2 px-3" style={{ color: "oklch(0.65 0.01 240)" }}>{t.scene}</td>
                  <td className="py-2 px-3" style={{ color: "oklch(0.55 0.01 240)", fontFamily: "'JetBrains Mono', monospace" }}>{t.tip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex justify-end pt-2">
        <Button onClick={handleComplete} className="flex items-center gap-2 px-6"
          style={{ background: "oklch(0.75 0.17 65)", color: "oklch(0.1 0.005 240)", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600 }}>
          <CheckCircle2 className="w-4 h-4" />
          完成本阶段，查看参考素材库
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
