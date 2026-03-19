/**
 * AIEstimateHint — 在 AI 生成期间显示预估时间和实时计时器
 *
 * 用法：
 *   <AIEstimateHint isLoading={isGenerating} min={15} max={35} />
 */
import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";

interface Props {
  isLoading: boolean;
  /** 预估最短秒数 */
  min: number;
  /** 预估最长秒数 */
  max: number;
  /** 额外的 className */
  className?: string;
}

export function AIEstimateHint({ isLoading, min, max, className = "" }: Props) {
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isLoading) {
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed((s) => s + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setElapsed(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isLoading]);

  if (!isLoading) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs ${className}`}
      style={{ color: "oklch(0.55 0.008 240)" }}
    >
      <Clock className="w-3 h-3 flex-shrink-0" />
      <span>
        预计 {min}–{max}s
        {elapsed > 0 && (
          <span style={{ color: "oklch(0.70 0.12 65)" }}>
            {" "}
            · 已用 {elapsed}s
          </span>
        )}
      </span>
    </span>
  );
}
