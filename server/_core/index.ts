import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStripeWebhook } from "../routers/stripeWebhook";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import multer from "multer";
import { storagePut } from "../storage";
import { nanoid } from "nanoid";
import { parseScriptFile } from "../lib/scriptParser";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // Stripe webhook (must be before body parsers for raw body)
  registerStripeWebhook(app);
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // S3 direct upload for asset images
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
  app.post("/api/upload-asset-s3", upload.single("file"), async (req, res) => {
    try {
      const file = req.file;
      if (!file) { res.status(400).json({ error: "No file provided" }); return; }
      const ext = file.originalname.split(".").pop() || "png";
      const key = `assets/${nanoid()}.${ext}`;
      const { url } = await storagePut(key, file.buffer, file.mimetype);
      res.json({ url });
    } catch (err: any) {
      console.error("[S3 Upload Error]", err);
      res.status(500).json({ error: err.message || "Upload failed" });
    }
  });

  // Legacy upload endpoint (fallback)
  app.post("/api/upload-asset-image", upload.single("file"), async (req, res) => {
    try {
      const file = req.file;
      if (!file) { res.status(400).json({ error: "No file provided" }); return; }
      const ext = file.originalname.split(".").pop() || "png";
      const key = `assets/${nanoid()}.${ext}`;
      const { url } = await storagePut(key, file.buffer, file.mimetype);
      res.json({ url });
    } catch (err: any) {
      console.error("[Upload Error]", err);
      res.status(500).json({ error: err.message || "Upload failed" });
    }
  });

  // Script file upload (Excel / Word / TXT) → parse into episodes
  const scriptUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });
  app.post("/api/upload-script", scriptUpload.single("file"), async (req, res) => {
    try {
      const file = req.file;
      if (!file) { res.status(400).json({ error: "No file provided" }); return; }
      const ext = (file.originalname.split(".").pop() || "").toLowerCase();
      if (!["xlsx", "xls", "docx", "doc", "txt"].includes(ext)) {
        res.status(400).json({ error: "不支持的文件格式，请上传 .xlsx / .docx / .txt 文件" });
        return;
      }
      const episodes = await parseScriptFile(file.buffer, ext, file.originalname);
      res.json({ episodes, fileName: file.originalname });
    } catch (err: any) {
      console.error("[Script Parse Error]", err);
      res.status(500).json({ error: err.message || "文件解析失败" });
    }
  });
  // Download proxy: proxies S3 URLs to avoid CORS issues and enable browser download
  app.get("/api/download-proxy", async (req, res) => {
    try {
      const url = req.query.url as string;
      const filename = (req.query.filename as string) || "download";
      if (!url || !url.startsWith("http")) { res.status(400).json({ error: "Invalid URL" }); return; }
      const response = await fetch(url);
      if (!response.ok) { res.status(response.status).json({ error: "Fetch failed" }); return; }
      const contentType = response.headers.get("content-type") || "application/octet-stream";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`); 
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    } catch (err: any) {
      console.error("[Download Proxy Error]", err);
      res.status(500).json({ error: err.message || "Download failed" });
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
