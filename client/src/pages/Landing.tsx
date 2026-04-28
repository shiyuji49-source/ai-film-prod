import { ArrowRight, Boxes, Camera, Clapperboard, Film, ImageIcon, Layers, Play, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const HERO_BG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663381754893/9BgyFdoC3HjLKXJmyAaqgB/hero-bg-aFre9kdGFYSWzCA6sTB4wa.webp";

const S = {
  bg: "oklch(0.11 0.006 245)",
  panel: "oklch(0.15 0.008 245 / 0.86)",
  line: "oklch(0.30 0.012 245)",
  text: "oklch(0.94 0.006 70)",
  sub: "oklch(0.74 0.012 245)",
  dim: "oklch(0.52 0.012 245)",
  gold: "oklch(0.78 0.15 75)",
  blue: "oklch(0.68 0.15 235)",
  green: "oklch(0.72 0.18 155)",
};

export default function Landing({ onEnter, onEnterOverseas }: {
  onEnter: () => void;
  onEnterOverseas: () => void;
}) {
  const steps = [
    { icon: <Layers size={16} />, title: "项目定义", text: "核心设定、受众、视觉风格与制作约束" },
    { icon: <Film size={16} />, title: "智能分集", text: "长剧本拆集并生成每集分镜设计" },
    { icon: <Boxes size={16} />, title: "资产提示词", text: "演员、场景、服化道的资产提示词和参考图入库" },
    { icon: <ImageIcon size={16} />, title: "分镜草图", text: "每个镜头生成 image2 简笔分镜草图" },
    { icon: <Camera size={16} />, title: "机位示意", text: "15 秒提示词配套人物调度与摄影机运动图" },
    { icon: <Play size={16} />, title: "Seedance 2.0", text: "多参考、智能参数、@引用资产生成视频" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: S.bg, color: S.text, overflow: "hidden" }}>
      <section style={{ minHeight: "78vh", position: "relative", display: "flex", alignItems: "center", padding: "56px 6vw 96px" }}>
        <img src={HERO_BG} alt="鎏光机精品剧" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, oklch(0.08 0.006 245 / 0.96), oklch(0.10 0.006 245 / 0.82), oklch(0.10 0.006 245 / 0.45))" }} />
        <div style={{ position: "relative", maxWidth: 760 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: S.gold, fontSize: 13, fontWeight: 800, marginBottom: 18 }}>
            <Clapperboard size={18} /> 鎏光机
          </div>
          <h1 style={{ margin: 0, fontSize: "clamp(44px, 6vw, 76px)", lineHeight: 1.02, letterSpacing: 0, fontWeight: 900 }}>
            精品剧 AI 制片工作台
          </h1>
          <p style={{ color: S.sub, fontSize: 18, lineHeight: 1.7, maxWidth: 620, margin: "22px 0 30px" }}>
            从项目定义、剧本分集、资产提示词，到分镜草图、机位图和 Seedance 2.0 多参考视频生成。
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Button onClick={onEnterOverseas} style={{ background: S.gold, color: S.bg, fontWeight: 900, height: 44, gap: 8 }}>
              进入精品剧 <ArrowRight size={16} />
            </Button>
            <Button onClick={onEnter} variant="outline" style={{ borderColor: S.line, color: S.text, height: 44, gap: 8 }}>
              项目库 <Sparkles size={15} />
            </Button>
          </div>
        </div>
      </section>

      <section style={{ padding: "0 6vw 44px", marginTop: -48, position: "relative" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {steps.map((step) => (
            <article key={step.title} style={{ background: S.panel, border: `1px solid ${S.line}`, borderRadius: 8, padding: 16, backdropFilter: "blur(16px)" }}>
              <div style={{ color: S.gold, marginBottom: 12 }}>{step.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>{step.title}</div>
              <div style={{ color: S.dim, fontSize: 12, lineHeight: 1.6 }}>{step.text}</div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
