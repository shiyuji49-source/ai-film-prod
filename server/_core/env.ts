export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // Stripe
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  // VectorEngine (unified API proxy for all AI services)
  vectorEngineApiKey: process.env.VECTORENGINE_API_KEY ?? "",
  vectorEngineApiUrl: process.env.VECTORENGINE_API_URL ?? "https://api.vectorengine.ai",
  // Legacy (kept for backward compatibility, now routed through VectorEngine)
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  falApiKey: process.env.FAL_API_KEY ?? "",
};
