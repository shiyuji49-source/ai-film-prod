import "dotenv/config";
import { execSync } from "node:child_process";

const baseUrl = (process.env.LQ_API_URL || "https://lqapi.top/v1").replace(/\/+$/, "");
const apiKey = process.env.LQ_API_KEY || "";

function safeText(value) {
  return String(value || "").replace(apiKey, "[redacted]");
}

function gitInfo() {
  try {
    return execSync("git log --oneline -1", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

async function post(path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180000),
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text: safeText(text) };
}

function hasImagePayload(text) {
  return /https?:\/\/|data:image\/|b64_json|image_url|output_url/i.test(text);
}

const prompt = "black and white storyboard sketch, simple line drawing, one empty film frame, no text";
const attempts = [
  {
    label: "images_openai_prefixed",
    path: "/images/generations",
    body: {
      model: "openai/gpt-image-2",
      prompt,
      size: "1024x1024",
    },
  },
  {
    label: "images_gpt_image_2",
    path: "/images/generations",
    body: {
      model: "gpt-image-2",
      prompt,
      size: "1024x1024",
    },
  },
  {
    label: "chat_messages_string",
    path: "/chat/completions",
    body: {
      model: "openai/gpt-image-2",
      messages: [{ role: "user", content: prompt }],
      prompt,
      size: "1024x1024",
      stream: false,
    },
  },
  {
    label: "chat_messages_parts",
    path: "/chat/completions",
    body: {
      model: "openai/gpt-image-2",
      messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
      prompt,
      size: "1024x1024",
      stream: false,
    },
  },
  {
    label: "chat_messages_only",
    path: "/chat/completions",
    body: {
      model: "openai/gpt-image-2",
      messages: [{ role: "user", content: prompt }],
      size: "1024x1024",
      stream: false,
    },
  },
  {
    label: "chat_prompt_only",
    path: "/chat/completions",
    body: {
      model: "openai/gpt-image-2",
      prompt,
      size: "1024x1024",
      stream: false,
    },
  },
];

console.log("=== LQ image2 自检 ===");
console.log(`代码版本: ${gitInfo()}`);
console.log(`LQ_API_URL: ${baseUrl}`);
console.log(`LQ_API_KEY: ${apiKey ? `已设置，长度 ${apiKey.length}` : "未设置"}`);

if (!apiKey) {
  console.log("结果: 失败，服务器 .env 没有 LQ_API_KEY");
  process.exit(1);
}

let lastError = "";
for (const attempt of attempts) {
  console.log(`\n尝试: ${attempt.label} -> ${attempt.path}`);
  const result = await post(attempt.path, attempt.body);
  const preview = result.text.slice(0, 1000);
  console.log(`HTTP: ${result.status}`);
  console.log(preview);
  if (result.ok && hasImagePayload(result.text)) {
    console.log("\n结果: 成功，LQ image2 渠道可用。");
    process.exit(0);
  }
  lastError = preview;
}

console.log("\n结果: 失败，所有 image2 请求格式都不可用。");
if (/No available channels|无可用渠道|模型渠道|insufficient|quota|余额/i.test(lastError)) {
  console.log("判断: LQ 账号的 openai/gpt-image-2 渠道或余额有问题，需要在 LQ 后台确认。");
} else if (/messages|缺少 messages/i.test(lastError)) {
  console.log("判断: LQ 网关要求的 image2 请求格式与示例不一致，需要 LQ 提供 Node.js 或 cURL 的精确 image2 调用模板。");
} else {
  console.log("判断: 需要把上面最后一段 HTTP 返回发给开发排查。");
}
process.exit(1);
