import "dotenv/config";
import { sql } from "drizzle-orm";
import { getDb } from "../server/db";
import { generateImage } from "../server/services/image-service";
import { callLLM } from "../server/services/llm-service";
import { generateSeedance2Prompt } from "../server/services/prompt-engine";
import { generateVideo } from "../server/services/video-service";
import { storagePut } from "../server/storage";
import { parseLlmJson } from "../server/lib/llm-json";

type SmokeStep = {
  name: string;
  run: () => Promise<Record<string, unknown> | void>;
};

function hasEnv(...names: string[]) {
  return names.every((name) => Boolean(process.env[name]));
}

function envStatus() {
  const storageReady =
    hasEnv("TOS_ACCESS_KEY_ID", "TOS_SECRET_ACCESS_KEY", "TOS_BUCKET", "TOS_ENDPOINT") ||
    hasEnv("AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_S3_BUCKET", "AWS_S3_ENDPOINT") ||
    hasEnv("BUILT_IN_FORGE_API_URL", "BUILT_IN_FORGE_API_KEY");
  return {
    DATABASE_URL: Boolean(process.env.DATABASE_URL),
    LQ_API_KEY: Boolean(process.env.LQ_API_KEY),
    LQ_API_URL: process.env.LQ_API_URL || "https://lqapi.top/v1",
    ARK_API_KEY: Boolean(process.env.ARK_API_KEY),
    ARK_API_URL: process.env.ARK_API_URL || "https://ark.cn-beijing.volces.com/api/v3",
    SEEDANCE_2_MODEL: process.env.SEEDANCE_2_MODEL || "doubao-seedance-2-0-260128",
    STORAGE: storageReady,
  };
}

function preview(value: string, max = 220) {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function requireEnv(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

async function assertFetchable(url: string, label: string) {
  const res = await fetch(url, { method: "GET", headers: { Range: "bytes=0-1023" } });
  if (!res.ok && res.status !== 206) {
    throw new Error(`${label} URL 不可访问: HTTP ${res.status}`);
  }
  return {
    status: res.status,
    contentType: res.headers.get("content-type") || "unknown",
  };
}

async function runStep(step: SmokeStep) {
  const start = Date.now();
  process.stdout.write(`\n==> ${step.name}\n`);
  const result = await step.run();
  const ms = Date.now() - start;
  console.log(JSON.stringify({ ok: true, ms, ...(result || {}) }, null, 2));
}

console.log("=== 鎏光机精品剧端到端验收 ===");
console.log(JSON.stringify(envStatus(), null, 2));

const skipVideo = process.env.SMOKE_SKIP_VIDEO === "1";
const videoDuration = Math.max(4, Math.min(15, Number(process.env.SMOKE_VIDEO_DURATION || 4)));
let imageUrl = "";
let seedancePrompt = "";

const steps: SmokeStep[] = [
  {
    name: "环境变量检查",
    run: async () => {
      const status = envStatus();
      requireEnv(status.LQ_API_KEY, "缺少 LQ_API_KEY");
      requireEnv(status.ARK_API_KEY || skipVideo, "缺少 ARK_API_KEY，无法验收 Seedance 2.0");
      requireEnv(status.STORAGE, "缺少 TOS/S3/Forge 对象存储配置");
      return status;
    },
  },
  {
    name: "数据库连接",
    run: async () => {
      if (!process.env.DATABASE_URL) return { skipped: "DATABASE_URL 未设置，只跳过数据库探测" };
      const db = await getDb();
      if (!db) throw new Error("数据库初始化失败");
      await db.execute(sql`select 1`);
      return { connected: true };
    },
  },
  {
    name: "对象存储写入",
    run: async () => {
      const key = `smoke/text/${Date.now()}.txt`;
      const { url } = await storagePut(key, `liuguang smoke ${new Date().toISOString()}`, "text/plain");
      const probe = await assertFetchable(url, "对象存储测试文件");
      return { url, ...probe };
    },
  },
  {
    name: "LLM 结构化输出",
    run: async () => {
      const raw = await callLLM({
        systemPrompt: "你是鎏光机验收助手。必须只输出 JSON。",
        prompt: "请输出 JSON：{\"ok\":true,\"stage\":\"llm\",\"note\":\"链路正常\"}",
        temperature: 0.2,
        maxTokens: 300,
      });
      const parsed = parseLlmJson<{ ok?: boolean; stage?: string; note?: string }>(raw, "LLM 验收");
      if (!parsed.ok) throw new Error(`LLM 返回异常: ${raw}`);
      return { raw: preview(raw) };
    },
  },
  {
    name: "image2 生成并上传 TOS",
    run: async () => {
      const result = await generateImage({
        engine: "image2",
        aspectRatio: "9:16",
        s3KeyPrefix: `smoke/image2/${Date.now()}`,
        prompt: [
          "black and white storyboard sketch, simple clean line drawing",
          "one cinematic vertical frame, a young film director standing beside a camera tripod",
          "clear character silhouette, simple camera diagram arrows, no text, no watermark",
        ].join(", "),
      });
      imageUrl = result.url;
      const probe = await assertFetchable(imageUrl, "image2 图片");
      return { url: imageUrl, ...probe };
    },
  },
  {
    name: "Seedance 2.0 15秒提示词生成",
    run: async () => {
      seedancePrompt = await generateSeedance2Prompt(
        {
          shotNumber: 1,
          sceneName: "interior studio",
          shotType: "medium shot, gentle push-in",
          visualDescription: "A director studies the monitor, then silently raises one hand to cue the actor. The movement is restrained and continuous.",
          characters: "Director",
          emotion: "quiet focus, controlled tension",
          duration: 15,
        },
        [{ role: "style", name: "image2 storyboard smoke reference", url: imageUrl }],
        {
          projectDefinition: "鎏光机内部验收项目：验证精品剧从 LLM 到 image2 再到 Seedance 2.0 的生产链路。",
          projectBible: "克制表演，动作留白，摄影机运动稳定，保持参考图人物和机位关系。",
          visualStylePrompt: "低照度，高反差，轻微雾霾空气介质，数字电影机质感，表演以停顿和眼神为核心。",
          aspectRatio: "9:16",
        }
      );
      if (!seedancePrompt.trim()) throw new Error("Seedance 2.0 提示词为空");
      return { prompt: preview(seedancePrompt, 500) };
    },
  },
];

if (!skipVideo) {
  steps.push({
    name: `Seedance 2.0 视频生成并上传 TOS（${videoDuration}s）`,
    run: async () => {
      const result = await generateVideo({
        engine: "seedance-2.0",
        prompt: seedancePrompt,
        referenceImageUrls: [imageUrl],
        aspectRatio: "9:16",
        duration: videoDuration,
        s3KeyPrefix: `smoke/video/${Date.now()}`,
      });
      const probe = await assertFetchable(result.url, "Seedance 视频");
      return { taskId: result.taskId, url: result.url, ...probe };
    },
  });
} else {
  console.log("提示: SMOKE_SKIP_VIDEO=1，本次跳过 Seedance 视频生成。");
}

for (const step of steps) {
  try {
    await runStep(step);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ ok: false, step: step.name, error: message }, null, 2));
    process.exit(1);
  }
}

console.log("\n=== 验收通过：LLM / image2 / TOS / Seedance 2.0 链路可用 ===");
