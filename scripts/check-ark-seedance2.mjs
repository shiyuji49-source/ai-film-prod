import "dotenv/config";

const apiKey = process.env.ARK_API_KEY || "";
const baseUrl = (process.env.ARK_API_URL || "https://ark.cn-beijing.volces.com/api/v3").replace(/\/+$/, "");
const model = process.env.SEEDANCE_2_MODEL || "doubao-seedance-2-0-260128";

function mask(value) {
  if (!value) return "未设置";
  return `${value.slice(0, 6)}...${value.slice(-4)}（长度 ${value.length}）`;
}

async function main() {
  console.log("=== Ark Seedance 2.0 模型权限自检 ===");
  console.log(`ARK_API_URL: ${baseUrl}`);
  console.log(`ARK_API_KEY: ${mask(apiKey)}`);
  console.log(`SEEDANCE_2_MODEL: ${model}`);

  if (!apiKey) {
    console.error("结果: 失败，服务器 .env 没有 ARK_API_KEY");
    process.exit(1);
  }

  const body = {
    model,
    content: [
      {
        type: "text",
        text: "第一人称视角，手拿一杯苹果果茶递向镜头，画面稳定，轻微推近，4秒短视频测试。",
      },
      {
        type: "image_url",
        image_url: {
          url: "https://ark-project.tos-cn-beijing.volces.com/doc_image/r2v_tea_pic1.jpg",
        },
        role: "reference_image",
      },
    ],
    generate_audio: false,
    ratio: "16:9",
    duration: 4,
    watermark: true,
  };

  const res = await fetch(`${baseUrl}/contents/generations/tasks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  console.log(`HTTP: ${res.status}`);
  console.log(text);

  if (!res.ok) {
    if (text.includes("ModelNotOpen")) {
      console.error("\n结论: 这把 ARK_API_KEY 所属账号没有开通该模型。请把“已开通账号”的 API Key 写入服务器 .env。");
    } else if (text.includes("InvalidEndpointOrModel")) {
      console.error("\n结论: 模型 ID 或接入点名称不匹配。请把火山控制台显示的模型/接入点 ID 写入 SEEDANCE_2_MODEL。");
    } else {
      console.error("\n结论: Ark 调用失败，请按上面的 HTTP 返回继续定位。");
    }
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = {};
  }

  const taskId = data.id || data.task_id || data.taskId;
  if (!taskId) {
    console.error("结论: 请求成功但没有返回任务 ID，请检查 Ark 返回结构。");
    process.exit(1);
  }

  console.log(`\n结果: 成功，Seedance 2.0 模型真正可用。taskId=${taskId}`);
  console.log("提示: 这个脚本只创建 4 秒测试任务，不轮询下载视频。");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
