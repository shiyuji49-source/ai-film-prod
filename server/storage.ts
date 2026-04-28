import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./_core/env";

type ForgeStorageConfig = { baseUrl: string; apiKey: string };
type S3StorageConfig = {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucket: string;
  endpoint: string;
  publicUrl?: string;
  publicRead: boolean;
  forcePathStyle: boolean;
  objectAcl?: string;
};

let s3Client: S3Client | null = null;

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeEndpoint(value: string): string {
  if (!value) return value;
  return /^https?:\/\//i.test(value)
    ? value.replace(/\/+$/, "")
    : `https://${value.replace(/\/+$/, "")}`;
}

function encodeKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

function readBool(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function getS3Config(): S3StorageConfig | null {
  const accessKeyId =
    process.env.TOS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || "";
  const secretAccessKey =
    process.env.TOS_SECRET_ACCESS_KEY ||
    process.env.AWS_SECRET_ACCESS_KEY ||
    "";
  const region =
    process.env.TOS_REGION || process.env.AWS_REGION || "cn-beijing";
  const bucket = process.env.TOS_BUCKET || process.env.AWS_S3_BUCKET || "";
  const endpoint = normalizeEndpoint(
    process.env.TOS_ENDPOINT || process.env.AWS_S3_ENDPOINT || ""
  );

  if (!accessKeyId || !secretAccessKey || !bucket || !endpoint) return null;

  return {
    accessKeyId,
    secretAccessKey,
    region,
    bucket,
    endpoint,
    publicUrl:
      process.env.TOS_PUBLIC_URL || process.env.AWS_S3_PUBLIC_URL || undefined,
    publicRead: readBool(process.env.S3_PUBLIC_READ, true),
    forcePathStyle: readBool(process.env.S3_FORCE_PATH_STYLE, false),
    objectAcl:
      process.env.TOS_OBJECT_ACL || process.env.AWS_S3_OBJECT_ACL || undefined,
  };
}

function getS3Client(config: S3StorageConfig): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }
  return s3Client;
}

function buildPublicObjectUrl(config: S3StorageConfig, key: string): string {
  if (config.publicUrl) {
    return `${config.publicUrl.replace(/\/+$/, "")}/${encodeKey(key)}`;
  }

  const endpoint = new URL(config.endpoint);
  return `${endpoint.protocol}//${config.bucket}.${endpoint.host}/${encodeKey(key)}`;
}

async function buildS3DownloadUrl(
  config: S3StorageConfig,
  key: string
): Promise<string> {
  if (config.publicRead) return buildPublicObjectUrl(config, key);

  return getSignedUrl(
    getS3Client(config),
    new GetObjectCommand({ Bucket: config.bucket, Key: key }),
    { expiresIn: 60 * 60 * 24 }
  );
}

function getForgeConfig(): ForgeStorageConfig | null {
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) return null;
  return {
    baseUrl: ENV.forgeApiUrl.replace(/\/+$/, ""),
    apiKey: ENV.forgeApiKey,
  };
}

function buildForgeUploadUrl(baseUrl: string, relKey: string): URL {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}

async function buildForgeDownloadUrl(
  baseUrl: string,
  relKey: string,
  apiKey: string
): Promise<string> {
  const downloadApiUrl = new URL(
    "v1/storage/downloadUrl",
    ensureTrailingSlash(baseUrl)
  );
  downloadApiUrl.searchParams.set("path", normalizeKey(relKey));
  const response = await fetch(downloadApiUrl, {
    method: "GET",
    headers: buildForgeAuthHeaders(apiKey),
  });
  return (await response.json()).url;
}

function toFormData(
  data: Buffer | Uint8Array | string,
  contentType: string,
  fileName: string
): FormData {
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}

function buildForgeAuthHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}` };
}

async function storagePutS3(
  config: S3StorageConfig,
  key: string,
  data: Buffer | Uint8Array | string,
  contentType: string
): Promise<{ key: string; url: string }> {
  const putInput: any = {
    Bucket: config.bucket,
    Key: key,
    Body: data,
    ContentType: contentType,
  };

  if (config.objectAcl) putInput.ACL = config.objectAcl;

  await getS3Client(config).send(new PutObjectCommand(putInput));
  return { key, url: await buildS3DownloadUrl(config, key) };
}

async function storagePutForge(
  config: ForgeStorageConfig,
  key: string,
  data: Buffer | Uint8Array | string,
  contentType: string
): Promise<{ key: string; url: string }> {
  const uploadUrl = buildForgeUploadUrl(config.baseUrl, key);
  const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: buildForgeAuthHeaders(config.apiKey),
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(
      `Storage upload failed (${response.status} ${response.statusText}): ${message}`
    );
  }

  const url = (await response.json()).url;
  return { key, url };
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  const preferredProvider = process.env.STORAGE_PROVIDER || "";
  const s3Config = preferredProvider !== "forge" ? getS3Config() : null;

  if (s3Config) return storagePutS3(s3Config, key, data, contentType);

  const forgeConfig = getForgeConfig();
  if (forgeConfig) return storagePutForge(forgeConfig, key, data, contentType);

  throw new Error(
    "Storage credentials missing: set TOS/AWS S3 variables or BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
  );
}

export async function storageGet(
  relKey: string
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  const preferredProvider = process.env.STORAGE_PROVIDER || "";
  const s3Config = preferredProvider !== "forge" ? getS3Config() : null;

  if (s3Config) return { key, url: await buildS3DownloadUrl(s3Config, key) };

  const forgeConfig = getForgeConfig();
  if (forgeConfig) {
    return {
      key,
      url: await buildForgeDownloadUrl(
        forgeConfig.baseUrl,
        key,
        forgeConfig.apiKey
      ),
    };
  }

  throw new Error(
    "Storage credentials missing: set TOS/AWS S3 variables or BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
  );
}
