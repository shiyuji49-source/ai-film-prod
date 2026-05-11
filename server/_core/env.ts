export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  internalAccessPassword: process.env.INTERNAL_ACCESS_PASSWORD ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // Stripe
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  // VectorEngine (legacy/optional image and generic video providers)
  vectorEngineApiKey: process.env.VECTORENGINE_API_KEY ?? "",
  vectorEngineApiUrl: process.env.VECTORENGINE_API_URL ?? "https://api.vectorengine.ai",
  // LQ API (LLM + image2)
  lqApiKey: process.env.LQ_API_KEY ?? "",
  lqApiUrl: process.env.LQ_API_URL ?? "https://lqapi.top/v1",
  lqUserId: process.env.LQ_USER_ID ?? "liuguang_internal",
  // ARK API (Volcano Engine direct API for Seedance video generation)
  arkApiKey: process.env.ARK_API_KEY ?? "",
  arkApiUrl: process.env.ARK_API_URL ?? "https://ark.cn-beijing.volces.com/api/v3",
  seedance2Model: process.env.SEEDANCE_2_MODEL ?? "doubao-seedance-2-0-260128",
  seedance2FallbackModels: process.env.SEEDANCE_2_FALLBACK_MODELS ?? "",
  // Legacy (kept for backward compatibility)
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  falApiKey: process.env.FAL_API_KEY ?? "",
};
