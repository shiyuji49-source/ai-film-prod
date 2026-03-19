import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Zap, Star, Crown } from "lucide-react";

interface CreditsShopDialogProps {
  open: boolean;
  onClose: () => void;
}

const PACKAGE_ICONS = [Zap, Star, Crown];
const PACKAGE_COLORS = [
  "oklch(0.55 0.15 200)",   // 蓝色 - 入门包
  "oklch(0.75 0.17 65)",    // 金色 - 标准包
  "oklch(0.65 0.18 310)",   // 紫色 - 专业包
];

export default function CreditsShopDialog({ open, onClose }: CreditsShopDialogProps) {
  const [selectedPkg, setSelectedPkg] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const { data: packages, isLoading } = trpc.payment.getPackages.useQuery(undefined, {
    enabled: open,
  });

  const checkoutMutation = trpc.payment.createCheckout.useMutation({
    onSuccess: ({ checkoutUrl }) => {
      toast.info("正在跳转到支付页面...");
      window.open(checkoutUrl, "_blank");
      setIsRedirecting(false);
      onClose();
    },
    onError: (err) => {
      toast.error(`创建支付失败：${err.message}`);
      setIsRedirecting(false);
    },
  });

  const handlePurchase = (pkgId: string) => {
    setSelectedPkg(pkgId);
    setIsRedirecting(true);
    checkoutMutation.mutate({
      packageId: pkgId,
      origin: window.location.origin,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-lg"
        style={{ background: "oklch(0.14 0.006 240)", border: "1px solid oklch(0.25 0.008 240)" }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: "oklch(0.92 0.005 60)", fontFamily: "'Space Grotesk', sans-serif" }}>
            购买积分
          </DialogTitle>
          <DialogDescription style={{ color: "oklch(0.55 0.008 240)" }}>
            积分用于 AI 功能：解析剧本 1积分，生成分镜 1积分/个，生成视频提示词 3积分/条
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: "oklch(0.75 0.17 65)" }} />
          </div>
        ) : (
          <div className="grid gap-3 mt-2">
            {packages?.map((pkg, i) => {
              const Icon = PACKAGE_ICONS[i] ?? Zap;
              const color = PACKAGE_COLORS[i] ?? PACKAGE_COLORS[0];
              const isSelected = selectedPkg === pkg.id;
              const isLoading = isRedirecting && isSelected;

              return (
                <button
                  key={pkg.id}
                  onClick={() => handlePurchase(pkg.id)}
                  disabled={isRedirecting}
                  className="relative flex items-center gap-4 p-4 rounded-lg text-left transition-all"
                  style={{
                    background: pkg.popular
                      ? "oklch(0.20 0.012 65 / 0.4)"
                      : "oklch(0.18 0.006 240)",
                    border: pkg.popular
                      ? `1px solid oklch(0.75 0.17 65 / 0.5)`
                      : "1px solid oklch(0.25 0.008 240)",
                    cursor: isRedirecting ? "not-allowed" : "pointer",
                    opacity: isRedirecting && !isSelected ? 0.5 : 1,
                  }}
                >
                  {/* 热门标签 */}
                  {pkg.popular && (
                    <div className="absolute -top-2 right-3">
                      <Badge
                        className="text-[10px] px-2 py-0"
                        style={{ background: "oklch(0.75 0.17 65)", color: "oklch(0.1 0.005 240)" }}
                      >
                        最受欢迎
                      </Badge>
                    </div>
                  )}

                  {/* 图标 */}
                  <div
                    className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ background: `${color} / 0.15`, border: `1px solid ${color} / 0.3` }}
                  >
                    <Icon className="w-5 h-5" style={{ color }} />
                  </div>

                  {/* 内容 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm" style={{ color: "oklch(0.88 0.005 60)", fontFamily: "'Space Grotesk', sans-serif" }}>
                        {pkg.name}
                      </span>
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: "oklch(0.55 0.008 240)" }}>
                      {pkg.description}
                    </div>
                  </div>

                  {/* 积分和价格 */}
                  <div className="flex-shrink-0 text-right">
                    <div className="font-bold text-base" style={{ color, fontFamily: "'Space Grotesk', sans-serif" }}>
                      {pkg.credits.toLocaleString()} 积分
                    </div>
                    <div className="text-sm font-semibold mt-0.5" style={{ color: "oklch(0.75 0.17 65)" }}>
                      {pkg.amountDisplay}
                    </div>
                  </div>

                  {/* 加载状态 */}
                  {isLoading && (
                    <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" style={{ color: "oklch(0.75 0.17 65)" }} />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* 测试提示 */}
        <div
          className="mt-3 p-3 rounded-lg text-xs"
          style={{ background: "oklch(0.16 0.008 240)", color: "oklch(0.50 0.008 240)", border: "1px solid oklch(0.22 0.006 240)" }}
        >
          测试支付请使用卡号：4242 4242 4242 4242，有效期任意未来日期，CVV 任意三位数
        </div>
      </DialogContent>
    </Dialog>
  );
}
