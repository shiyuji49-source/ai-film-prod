import { createHash, timingSafeEqual } from "crypto";
import type { Request } from "express";
import type { User } from "../../drizzle/schema";
import { ENV } from "./env";

export const INTERNAL_ACCESS_COOKIE = "liuguang_internal_access";

const INTERNAL_USER_ID = 1;

function secretSalt() {
  return ENV.cookieSecret || "liuguang-internal-access";
}

export function hasInternalAccessPassword() {
  return ENV.internalAccessPassword.trim().length > 0;
}

export function createInternalAccessToken() {
  return createHash("sha256")
    .update(`${ENV.internalAccessPassword}:${secretSalt()}`)
    .digest("hex");
}

export function validateInternalPassword(password: string) {
  if (!hasInternalAccessPassword()) return false;
  return password === ENV.internalAccessPassword;
}

export function parseCookieHeader(cookieHeader?: string | null) {
  const cookies = new Map<string, string>();
  if (!cookieHeader) return cookies;
  for (const part of cookieHeader.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    const value = decodeURIComponent(part.slice(index + 1).trim());
    cookies.set(key, value);
  }
  return cookies;
}

export function requestHasInternalAccess(req: Request) {
  if (!hasInternalAccessPassword()) return false;
  const token = parseCookieHeader(req.headers.cookie).get(INTERNAL_ACCESS_COOKIE);
  if (!token) return false;
  const expected = createInternalAccessToken();
  const tokenBuffer = Buffer.from(token);
  const expectedBuffer = Buffer.from(expected);
  if (tokenBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(tokenBuffer, expectedBuffer);
}

export function getInternalUser(): User {
  const now = new Date();
  return {
    id: INTERNAL_USER_ID,
    openId: "internal-liuguang",
    identifier: "internal@liuguang.local",
    identifierType: "email",
    passwordHash: null,
    name: "鎏光机内部用户",
    email: "internal@liuguang.local",
    loginMethod: "internal",
    role: "admin",
    credits: 1000000,
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  };
}
