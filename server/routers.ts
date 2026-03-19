import { systemRouter } from "./_core/systemRouter";
import { router } from "./_core/trpc";
import { aiRouter } from "./routers/ai";
import { authRouter } from "./routers/auth";
import { projectsRouter } from "./routers/projects";
import { adminRouter } from "./routers/admin";
import { paymentRouter } from "./routers/payment";
import { assetsRouter } from "./routers/assets";
import { apiSettingsRouter } from "./routers/apiSettings";
import { overseasRouter } from "./routers/overseas";

export const appRouter = router({
  system: systemRouter,
  ai: aiRouter,
  auth: authRouter,
  projects: projectsRouter,
  admin: adminRouter,
  payment: paymentRouter,
  assets: assetsRouter,
  apiSettings: apiSettingsRouter,
  overseas: overseasRouter,
});

export type AppRouter = typeof appRouter;
