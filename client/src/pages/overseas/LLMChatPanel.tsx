import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Send, Loader2, Bot, User, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const C = {
  bg: "oklch(0.10 0.005 240)",
  surface: "oklch(0.13 0.006 240)",
  card: "oklch(0.15 0.006 240)",
  border: "oklch(0.20 0.006 240)",
  green: "oklch(0.72 0.20 160)",
  greenDim: "oklch(0.72 0.20 160 / 0.15)",
  text: "oklch(0.88 0.005 60)",
  textSub: "oklch(0.70 0.008 240)",
  muted: "oklch(0.50 0.01 240)",
};

type Message = { role: "user" | "assistant"; content: string };

const QUICK_PROMPTS = [
  "如何优化这个场景的视觉描述？",
  "这个角色的外形描述怎么写更好？",
  "帮我生成一个适合 Seedream 4.5 的提示词",
  "Seedance 1.5 Pro 的视频提示词怎么写？",
  "如何让首帧和视频更连贯？",
];

interface LLMChatPanelProps {
  projectId: number;
  context?: string;
}

export function LLMChatPanel({ projectId, context }: LLMChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const chatMutation = trpc.overseas.chatWithLLM.useMutation({
    onSuccess: (data) => {
      setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
      setIsLoading(false);
    },
    onError: (err) => {
      toast.error("AI 回复失败：" + err.message);
      setIsLoading(false);
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = (content: string) => {
    if (!content.trim() || isLoading) return;
    const userMsg: Message = { role: "user", content: content.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);
    chatMutation.mutate({
      projectId,
      message: content.trim(),
      history: messages.slice(-10),
      context,
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.bg }}>
      {/* Header */}
      <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <Bot size={15} style={{ color: C.green }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>AI 制作顾问</span>
        <span style={{ fontSize: 10, color: C.muted, marginLeft: "auto" }}>基于项目上下文</span>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", paddingTop: 20 }}>
            <Sparkles size={28} style={{ color: C.green, margin: "0 auto 10px" }} />
            <p style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>向 AI 顾问提问，获取专业建议</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {QUICK_PROMPTS.map(p => (
                <button
                  key={p}
                  onClick={() => sendMessage(p)}
                  style={{
                    padding: "7px 12px", borderRadius: 8, cursor: "pointer",
                    border: `1px solid ${C.border}`, background: C.card,
                    color: C.textSub, fontSize: 11, textAlign: "left",
                    transition: "all 0.15s",
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", gap: 8, flexDirection: msg.role === "user" ? "row-reverse" : "row", alignItems: "flex-start" }}>
            <div style={{
              width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
              background: msg.role === "user" ? C.green : "oklch(0.20 0.006 240)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {msg.role === "user"
                ? <User size={13} style={{ color: "oklch(0.08 0.005 240)" }} />
                : <Bot size={13} style={{ color: C.green }} />
              }
            </div>
            <div style={{
              maxWidth: "80%", padding: "8px 12px", borderRadius: 10,
              background: msg.role === "user" ? C.greenDim : C.card,
              border: `1px solid ${msg.role === "user" ? "oklch(0.72 0.20 160 / 0.3)" : C.border}`,
              fontSize: 12, color: C.text, lineHeight: 1.6,
              whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}>
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: "oklch(0.20 0.006 240)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Bot size={13} style={{ color: C.green }} />
            </div>
            <div style={{ padding: "8px 12px", borderRadius: 10, background: C.card, border: `1px solid ${C.border}` }}>
              <Loader2 size={14} className="animate-spin" style={{ color: C.green }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "10px 14px", borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
            }}
            placeholder="提问或描述需求... (Enter 发送)"
            rows={2}
            style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, color: C.text, fontSize: 12, resize: "none" }}
          />
          <Button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            style={{ background: C.green, color: "oklch(0.08 0.005 240)", height: 52, width: 40, padding: 0 }}
          >
            {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </Button>
        </div>
        <p style={{ fontSize: 10, color: "oklch(0.35 0.008 240)", marginTop: 4 }}>Shift+Enter 换行</p>
      </div>
    </div>
  );
}
