// DESIGN: "鎏光机" 导演手册工业风暗色系 — Landing Page v2
// Layout: Hero + 两大板块入口（跑量剧/精品剧）+ 工具链
// Colors: bg oklch(0.11), amber oklch(0.75 0.17 65), steel oklch(0.22 0.006 240)
// Font: Space Grotesk headings, JetBrains Mono labels, Noto Sans SC body

import { motion } from "framer-motion";
import {
  Clapperboard,
  ChevronRight,
  ArrowRight,
  Zap,
  Sparkles,
  Film,
  Layers,
  Wand2,
  Cpu,
  Music,
  Video,
  Users,
  Globe,
} from "lucide-react";

const HERO_BG =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663381754893/9BgyFdoC3HjLKXJmyAaqgB/landing-hero-4sV3bxk8aqsm9qMnnuMVrt.webp";

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: "easeOut" as const },
  },
};

interface LandingProps {
  onEnter: () => void;
  onEnterOverseas?: () => void;
}

export default function Landing({ onEnter, onEnterOverseas }: LandingProps) {
  return (
    <div
      style={{
        background: "oklch(0.11 0.005 240)",
        color: "oklch(0.88 0.005 60)",
        fontFamily: "'Noto Sans SC', 'Space Grotesk', sans-serif",
        overflowX: "hidden",
      }}
    >
      {/* ── NAV ── */}
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          borderBottom: "1px solid oklch(0.20 0.006 240 / 0.8)",
          backdropFilter: "blur(12px)",
          background: "oklch(0.11 0.005 240 / 0.85)",
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "0 2rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: 60,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                background: "oklch(0.75 0.17 65)",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Clapperboard size={16} style={{ color: "oklch(0.1 0.005 240)" }} />
            </div>
            <div>
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: "-0.01em",
                  fontFamily: "'Space Grotesk', sans-serif",
                  color: "oklch(0.92 0.005 60)",
                }}
              >
                鎏光机
              </span>
              <span
                style={{
                  fontSize: 10,
                  marginLeft: 8,
                  color: "oklch(0.50 0.01 240)",
                  fontFamily: "'JetBrains Mono', monospace",
                  letterSpacing: "0.08em",
                }}
              >
                AI FILM WORKFLOW
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={onEnterOverseas}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "oklch(0.18 0.006 240)",
                color: "oklch(0.75 0.17 65)",
                border: "1px solid oklch(0.75 0.17 65 / 0.4)",
                borderRadius: 8,
                padding: "7px 16px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "'Space Grotesk', sans-serif",
                transition: "opacity 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              <Zap size={12} /> 跑量剧
            </button>
            <button
              onClick={onEnter}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "oklch(0.75 0.17 65)",
                color: "oklch(0.1 0.005 240)",
                border: "none",
                borderRadius: 8,
                padding: "8px 18px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "'Space Grotesk', sans-serif",
                transition: "opacity 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              <Sparkles size={13} /> 精品剧
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section
        style={{
          position: "relative",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          paddingTop: 60,
        }}
      >
        <img
          src={HERO_BG}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(105deg, oklch(0.11 0.005 240 / 0.97) 0%, oklch(0.11 0.005 240 / 0.85) 45%, oklch(0.11 0.005 240 / 0.5) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 200,
            background:
              "linear-gradient(to bottom, transparent, oklch(0.11 0.005 240))",
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 10,
            maxWidth: 1200,
            margin: "0 auto",
            padding: "0 2rem",
            width: "100%",
          }}
        >
          <motion.div
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.12 } } }}
          >
            <motion.div
              variants={fadeUp}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 24,
              }}
            >
              <div
                style={{
                  height: 1,
                  width: 40,
                  background: "oklch(0.75 0.17 65)",
                }}
              />
              <span
                style={{
                  fontSize: 11,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  color: "oklch(0.75 0.17 65)",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                AI Film Production Workflow
              </span>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              style={{
                fontSize: "clamp(3rem, 7vw, 6rem)",
                fontWeight: 800,
                lineHeight: 1.0,
                letterSpacing: "-0.03em",
                fontFamily: "'Space Grotesk', sans-serif",
                marginBottom: 8,
              }}
            >
              <span style={{ color: "oklch(0.95 0.005 60)" }}>鎏</span>
              <span style={{ color: "oklch(0.75 0.17 65)" }}>光</span>
              <span style={{ color: "oklch(0.95 0.005 60)" }}>机</span>
            </motion.h1>
            <motion.h2
              variants={fadeUp}
              style={{
                fontSize: "clamp(1.2rem, 3vw, 2rem)",
                fontWeight: 500,
                color: "oklch(0.72 0.008 240)",
                fontFamily: "'Space Grotesk', sans-serif",
                marginBottom: 28,
                letterSpacing: "-0.01em",
              }}
            >
              AI 影片制作全流程工作流工具
            </motion.h2>

            <motion.p
              variants={fadeUp}
              style={{
                fontSize: 16,
                lineHeight: 1.8,
                color: "oklch(0.65 0.01 240)",
                maxWidth: 520,
                marginBottom: 48,
              }}
            >
              两条赛道，一套工具链。<br />
              跑量剧快速批量出片，精品剧精雕细琢每一帧。
            </motion.p>

            {/* ── 两大板块入口卡片 ── */}
            <motion.div
              variants={fadeUp}
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, maxWidth: 760 }}
            >
              {/* 跑量剧 */}
              <button
                onClick={onEnterOverseas}
                style={{
                  background: "oklch(0.14 0.006 240)",
                  border: "2px solid oklch(0.75 0.17 65 / 0.5)",
                  borderRadius: 16,
                  padding: "28px 24px",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "border-color 0.2s, transform 0.2s, background 0.2s",
                  position: "relative",
                  overflow: "hidden",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "oklch(0.75 0.17 65)";
                  e.currentTarget.style.background = "oklch(0.16 0.007 240)";
                  e.currentTarget.style.transform = "translateY(-3px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "oklch(0.75 0.17 65 / 0.5)";
                  e.currentTarget.style.background = "oklch(0.14 0.006 240)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                {/* 背景装饰 */}
                <div style={{
                  position: "absolute", top: -20, right: -20, width: 100, height: 100,
                  borderRadius: "50%", background: "oklch(0.75 0.17 65 / 0.06)",
                }} />
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: "oklch(0.75 0.17 65 / 0.15)",
                    border: "1px solid oklch(0.75 0.17 65 / 0.4)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Zap size={20} style={{ color: "oklch(0.75 0.17 65)" }} />
                  </div>
                  <div>
                    <div style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
                      color: "oklch(0.75 0.17 65)", fontFamily: "'JetBrains Mono', monospace",
                      textTransform: "uppercase", marginBottom: 2,
                    }}>图生视频</div>
                    <div style={{
                      fontSize: 18, fontWeight: 800, color: "oklch(0.92 0.005 60)",
                      fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.01em",
                    }}>跑量剧</div>
                  </div>
                </div>
                <p style={{ fontSize: 13, color: "oklch(0.60 0.01 240)", lineHeight: 1.7, marginBottom: 18 }}>
                  真人短剧批量出片流水线。MJ 资产 → Gemini 首帧 → Kling 3.0 Elements 视频，全自动跑量。
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
                  {[
                    { icon: <Video size={11} />, text: "Kling 3.0 / Seedance / Veo 3.1" },
                    { icon: <Users size={11} />, text: "Elements 人物一致性" },
                    { icon: <Globe size={11} />, text: "20-30 集 · 全自动批量" },
                  ].map((item, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "oklch(0.55 0.01 240)" }}>
                      <span style={{ color: "oklch(0.75 0.17 65)" }}>{item.icon}</span>
                      {item.text}
                    </div>
                  ))}
                </div>
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  color: "oklch(0.75 0.17 65)", fontSize: 13, fontWeight: 700,
                }}>
                  进入跑量剧 <ArrowRight size={14} />
                </div>
              </button>

              {/* 精品剧 */}
              <button
                onClick={onEnter}
                style={{
                  background: "oklch(0.14 0.006 240)",
                  border: "2px solid oklch(0.65 0.15 280 / 0.4)",
                  borderRadius: 16,
                  padding: "28px 24px",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "border-color 0.2s, transform 0.2s, background 0.2s",
                  position: "relative",
                  overflow: "hidden",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "oklch(0.65 0.15 280 / 0.8)";
                  e.currentTarget.style.background = "oklch(0.16 0.007 240)";
                  e.currentTarget.style.transform = "translateY(-3px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "oklch(0.65 0.15 280 / 0.4)";
                  e.currentTarget.style.background = "oklch(0.14 0.006 240)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div style={{
                  position: "absolute", top: -20, right: -20, width: 100, height: 100,
                  borderRadius: "50%", background: "oklch(0.65 0.15 280 / 0.06)",
                }} />
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: "oklch(0.65 0.15 280 / 0.15)",
                    border: "1px solid oklch(0.65 0.15 280 / 0.4)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Sparkles size={20} style={{ color: "oklch(0.70 0.15 280)" }} />
                  </div>
                  <div>
                    <div style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
                      color: "oklch(0.70 0.15 280)", fontFamily: "'JetBrains Mono', monospace",
                      textTransform: "uppercase", marginBottom: 2,
                    }}>文生视频</div>
                    <div style={{
                      fontSize: 18, fontWeight: 800, color: "oklch(0.92 0.005 60)",
                      fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.01em",
                    }}>精品剧</div>
                  </div>
                </div>
                <p style={{ fontSize: 13, color: "oklch(0.60 0.01 240)", lineHeight: 1.7, marginBottom: 18 }}>
                  六阶段精品制作流水线。剧本解析 → 资产设计 → 分镜 → 提示词，精雕细琢每一帧。
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
                  {[
                    { icon: <Film size={11} />, text: "六阶段全流程引导" },
                    { icon: <Layers size={11} />, text: "MJ 7 + Gemini 3 Pro Image 资产" },
                    { icon: <Wand2 size={11} />, text: "AI 分镜 + 视频提示词生成" },
                  ].map((item, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "oklch(0.55 0.01 240)" }}>
                      <span style={{ color: "oklch(0.70 0.15 280)" }}>{item.icon}</span>
                      {item.text}
                    </div>
                  ))}
                </div>
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  color: "oklch(0.70 0.15 280)", fontSize: 13, fontWeight: 700,
                }}>
                  进入精品剧 <ArrowRight size={14} />
                </div>
              </button>
            </motion.div>

            {/* Stats */}
            <motion.div
              variants={fadeUp}
              style={{
                display: "flex",
                gap: 32,
                marginTop: 56,
                paddingTop: 32,
                borderTop: "1px solid oklch(0.22 0.006 240 / 0.5)",
                flexWrap: "wrap",
              }}
            >
              {[
                { val: "2", label: "制作赛道" },
                { val: "6", label: "精品阶段" },
                { val: "3+", label: "视频引擎" },
                { val: "∞", label: "项目管理" },
              ].map((s) => (
                <div key={s.label}>
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 800,
                      color: "oklch(0.75 0.17 65)",
                      fontFamily: "'JetBrains Mono', monospace",
                      lineHeight: 1,
                    }}
                  >
                    {s.val}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "oklch(0.55 0.01 240)",
                      marginTop: 4,
                    }}
                  >
                    {s.label}
                  </div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── 两大赛道详细说明 ── */}
      <section
        style={{
          padding: "100px 0",
          background: "oklch(0.12 0.005 240)",
        }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 2rem" }}>
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            variants={{ show: { transition: { staggerChildren: 0.1 } } }}
          >
            <motion.div variants={fadeUp} style={{ marginBottom: 60, textAlign: "center" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 16 }}>
                <div style={{ height: 1, width: 32, background: "oklch(0.75 0.17 65)" }} />
                <span style={{ fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "oklch(0.75 0.17 65)", fontFamily: "'JetBrains Mono', monospace" }}>Two Tracks</span>
                <div style={{ height: 1, width: 32, background: "oklch(0.75 0.17 65)" }} />
              </div>
              <h2 style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 700, letterSpacing: "-0.02em", fontFamily: "'Space Grotesk', sans-serif", color: "oklch(0.92 0.005 60)", marginBottom: 12 }}>
                两条赛道，各有所长
              </h2>
              <p style={{ fontSize: 15, color: "oklch(0.60 0.01 240)", maxWidth: 480, margin: "0 auto" }}>
                根据项目需求选择合适的制作路径，工具链共享，数据互通。
              </p>
            </motion.div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
              {/* 跑量剧详情 */}
              <motion.div variants={fadeUp} style={{
                background: "oklch(0.14 0.006 240)",
                border: "1px solid oklch(0.22 0.006 240)",
                borderRadius: 20,
                padding: "36px 32px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 12,
                    background: "oklch(0.75 0.17 65 / 0.12)",
                    border: "1px solid oklch(0.75 0.17 65 / 0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Zap size={24} style={{ color: "oklch(0.75 0.17 65)" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "oklch(0.75 0.17 65)", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>图生视频 · 批量跑量</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "oklch(0.92 0.005 60)", fontFamily: "'Space Grotesk', sans-serif" }}>跑量剧</div>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {[
                    { step: "01", title: "剧本拆解", desc: "导入完整剧本，AI 自动拆解集数、生成分镜文字描述，无风格设定，纯文字内容" },
                    { step: "02", title: "资产提示词", desc: "人物/场景/道具 MJ 提示词生成，上传 MJ 图后一键 Gemini 生成参考图" },
                    { step: "03", title: "批量跑量", desc: "选集数 → Gemini 首帧 → AI 视频提示词 → Kling 3.0 Elements 视频，全自动流水线" },
                  ].map((item) => (
                    <div key={item.step} style={{ display: "flex", gap: 14 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                        background: "oklch(0.75 0.17 65 / 0.12)",
                        border: "1px solid oklch(0.75 0.17 65 / 0.3)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, fontWeight: 700, color: "oklch(0.75 0.17 65)",
                        fontFamily: "'JetBrains Mono', monospace",
                      }}>{item.step}</div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "oklch(0.88 0.005 60)", marginBottom: 4 }}>{item.title}</div>
                        <div style={{ fontSize: 12, color: "oklch(0.55 0.01 240)", lineHeight: 1.6 }}>{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={onEnterOverseas}
                  style={{
                    marginTop: 28, width: "100%", padding: "12px 0",
                    background: "oklch(0.75 0.17 65)", color: "oklch(0.1 0.005 240)",
                    border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700,
                    cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    transition: "opacity 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                >
                  <Zap size={15} /> 进入跑量剧工作台
                </button>
              </motion.div>

              {/* 精品剧详情 */}
              <motion.div variants={fadeUp} style={{
                background: "oklch(0.14 0.006 240)",
                border: "1px solid oklch(0.22 0.006 240)",
                borderRadius: 20,
                padding: "36px 32px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 12,
                    background: "oklch(0.65 0.15 280 / 0.12)",
                    border: "1px solid oklch(0.65 0.15 280 / 0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Sparkles size={24} style={{ color: "oklch(0.70 0.15 280)" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "oklch(0.70 0.15 280)", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>文生视频 · 精品制作</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "oklch(0.92 0.005 60)", fontFamily: "'Space Grotesk', sans-serif" }}>精品剧</div>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {[
                    { step: "01", title: "项目定义", desc: "上传剧本，AI 解析分集、人物、场景、道具，支持 5 种格式，建立数据底座" },
                    { step: "02", title: "核心资产设计", desc: "MJ7 提示词 + Gemini 三视图/多角度图，人物/场景/道具全分类管理" },
                    { step: "03", title: "分镜 + 提示词", desc: "AI 自动分镜、情绪曲线可视化、Seedance 1.5 Pro 多镜头视频提示词生成" },
                    { step: "04-06", title: "生成 + 参考库", desc: "生成指引、后期建议、情绪关键词参考素材库一键复制" },
                  ].map((item) => (
                    <div key={item.step} style={{ display: "flex", gap: 14 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                        background: "oklch(0.65 0.15 280 / 0.12)",
                        border: "1px solid oklch(0.65 0.15 280 / 0.3)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 9, fontWeight: 700, color: "oklch(0.70 0.15 280)",
                        fontFamily: "'JetBrains Mono', monospace",
                      }}>{item.step}</div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "oklch(0.88 0.005 60)", marginBottom: 4 }}>{item.title}</div>
                        <div style={{ fontSize: 12, color: "oklch(0.55 0.01 240)", lineHeight: 1.6 }}>{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={onEnter}
                  style={{
                    marginTop: 28, width: "100%", padding: "12px 0",
                    background: "oklch(0.65 0.15 280)", color: "oklch(0.95 0.005 60)",
                    border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700,
                    cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    transition: "opacity 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                >
                  <Sparkles size={15} /> 进入精品剧工作台
                </button>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── 工具链 ── */}
      <section style={{ padding: "80px 0", background: "oklch(0.11 0.005 240)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 2rem" }}>
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            variants={{ show: { transition: { staggerChildren: 0.1 } } }}
          >
            <motion.div variants={fadeUp} style={{ textAlign: "center", marginBottom: 48 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 14 }}>
                <div style={{ height: 1, width: 32, background: "oklch(0.75 0.17 65)" }} />
                <span style={{ fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "oklch(0.75 0.17 65)", fontFamily: "'JetBrains Mono', monospace" }}>Toolchain</span>
                <div style={{ height: 1, width: 32, background: "oklch(0.75 0.17 65)" }} />
              </div>
              <h2 style={{ fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)", fontWeight: 700, letterSpacing: "-0.02em", fontFamily: "'Space Grotesk', sans-serif", color: "oklch(0.92 0.005 60)" }}>
                完整 AI 工具链
              </h2>
            </motion.div>
            <motion.div variants={fadeUp} style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
              {[
                { name: "Midjourney 7", role: "风格参考 & 资产提示词", color: "oklch(0.65 0.15 280)" },
                { name: "Gemini 3 Pro Image", role: "高精度首帧 & 三视图生成", color: "oklch(0.75 0.17 65)" },
                { name: "Kling 3.0", role: "Elements 人物一致性视频", color: "oklch(0.65 0.18 30)" },
                { name: "Seedance 1.5", role: "多镜头视频生成", color: "oklch(0.65 0.18 160)" },
                { name: "Veo 3.1", role: "高质量视频生成", color: "oklch(0.60 0.15 220)" },
                { name: "Claude AI", role: "剧本解析 & 提示词生成", color: "oklch(0.65 0.15 140)" },
              ].map((tool) => (
                <div key={tool.name} style={{
                  padding: "14px 20px", borderRadius: 12,
                  background: "oklch(0.14 0.006 240)",
                  border: `1px solid ${tool.color}40`,
                  minWidth: 180,
                }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: tool.color, marginBottom: 4, fontFamily: "'Space Grotesk', sans-serif" }}>{tool.name}</div>
                  <div style={{ fontSize: 12, color: "oklch(0.55 0.01 240)" }}>{tool.role}</div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{
        borderTop: "1px solid oklch(0.18 0.006 240)",
        padding: "24px 2rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        maxWidth: 1200,
        margin: "0 auto",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Clapperboard size={14} style={{ color: "oklch(0.75 0.17 65)" }} />
          <span style={{ fontSize: 12, color: "oklch(0.40 0.008 240)", fontFamily: "'JetBrains Mono', monospace" }}>
            鎏光机 AI 影片工作流工具
          </span>
        </div>
        <div style={{ display: "flex", gap: 20 }}>
          <button onClick={onEnterOverseas} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "oklch(0.75 0.17 65)", fontFamily: "'Space Grotesk', sans-serif" }}>
            跑量剧 →
          </button>
          <button onClick={onEnter} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "oklch(0.70 0.15 280)", fontFamily: "'Space Grotesk', sans-serif" }}>
            精品剧 →
          </button>
        </div>
      </footer>
    </div>
  );
}
