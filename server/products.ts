// 积分包产品定义
// 价格单位：分（人民币 CNY）
export const CREDIT_PACKAGES = [
  {
    id: "credits_1000",
    name: "入门包",
    credits: 1000,
    amountFen: 990,       // ¥9.90
    amountDisplay: "¥9.9",
    description: "适合轻度体验",
    popular: false,
  },
  {
    id: "credits_3000",
    name: "标准包",
    credits: 3000,
    amountFen: 2990,      // ¥29.90
    amountDisplay: "¥29.9",
    description: "最受欢迎，性价比之选",
    popular: true,
  },
  {
    id: "credits_10000",
    name: "专业包",
    credits: 10000,
    amountFen: 9990,      // ¥99.90
    amountDisplay: "¥99.9",
    description: "重度用户首选",
    popular: false,
  },
  {
    id: "credits_30000",
    name: "旗舰包",
    credits: 30000,
    amountFen: 29900,     // ¥299.00
    amountDisplay: "¥299",
    description: "团队级用量，超高性价比",
    popular: false,
  },
] as const;
export type CreditPackageId = typeof CREDIT_PACKAGES[number]["id"];;
