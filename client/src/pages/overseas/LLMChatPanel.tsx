import { useState } from "react";
import { AIChatBox, type Message } from "@/components/AIChatBox";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface LLMChatPanelProps {
  projectId: number;
  context?: string;
}

export function LLMChatPanel({ projectId: _projectId, context }: LLMChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const testMutation = trpc.ai.testConnection.useMutation({
    onSuccess: () => {
      setIsLoading(false);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("AI 连接失败：" + msg);
      setIsLoading(false);
    },
  });

  const handleSendMessage = (content: string) => {
    const userMsg: Message = { role: "user", content };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    // 使用 analyzeScript 作为通用 LLM 调用的占位
    // 实际项目中可扩展为独立的 chat procedure
    const systemContext = context
      ? `你是专业影视制作顾问。当前项目背景：${context}。请回答用户的问题。`
      : "你是专业影视制作顾问，请回答用户的问题。";

    // 模拟 AI 回复（testConnection 验证连接）
    testMutation.mutate(undefined, {
      onSuccess: () => {
        const assistantMsg: Message = {
          role: "assistant",
          content: `[AI 顾问] 收到您的问题：「${content}」\n\n${systemContext}\n\n请通过具体的剧本分析、角色生成等功能获取 AI 辅助。`,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setIsLoading(false);
      },
    });
  };

  return (
    <AIChatBox
      messages={messages}
      onSendMessage={handleSendMessage}
      isLoading={isLoading}
      placeholder="向 AI 顾问提问，例如：这个场景的视觉描述怎么优化？"
      height={500}
    />
  );
}
