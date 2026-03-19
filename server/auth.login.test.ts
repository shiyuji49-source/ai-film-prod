import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

// ─── Helpers ────────────────────────────────────────────────────────────────

type CookieCall = {
  name: string;
  value: string;
  options: Record<string, unknown>;
};

function createPublicContext(): { ctx: TrpcContext; setCookies: CookieCall[] } {
  const setCookies: CookieCall[] = [];

  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        setCookies.push({ name, value, options });
      },
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };

  return { ctx, setCookies };
}

function createAuthenticatedContext(userId = 30001): { ctx: TrpcContext } {
  const ctx: TrpcContext = {
    user: {
      id: userId,
      openId: null,
      email: null,
      name: "管理员",
      loginMethod: null,
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      identifier: "13772503890",
      identifierType: "phone",
      credits: 999999,
      passwordHash: "hashed",
    } as any,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
      cookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
  return { ctx };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("auth.login", () => {
  it("successfully logs in with valid phone + password", async () => {
    const { ctx, setCookies } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.login({
      identifier: "13772503890",
      password: "jishiyu21",
    });

    expect(result).toBeDefined();
    expect(result.id).toBe(30001);
    expect(result.identifier).toBe("13772503890");
    expect(result.identifierType).toBe("phone");
    expect(result.name).toBe("管理员");
    expect(result.role).toBe("admin");
    expect(result.credits).toBeGreaterThan(0);

    // Should have set a session cookie
    expect(setCookies).toHaveLength(1);
    expect(setCookies[0]?.name).toBe(COOKIE_NAME);
    expect(setCookies[0]?.value).toBeTruthy();
    expect(typeof setCookies[0]?.value).toBe("string");
  });

  it("rejects login with wrong password", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.login({
        identifier: "13772503890",
        password: "wrongpassword",
      })
    ).rejects.toThrow();
  });

  it("rejects login with non-existent account", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.login({
        identifier: "19999999999",
        password: "anypassword",
      })
    ).rejects.toThrow();
  });
});

describe("auth.me for custom login users", () => {
  it("returns user info for authenticated custom-login user", async () => {
    const { ctx } = createAuthenticatedContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();

    expect(result).toBeDefined();
    expect(result).not.toBeNull();
    expect(result?.id).toBe(30001);
    expect(result?.identifier).toBe("13772503890");
    expect(result?.role).toBe("admin");
  });

  it("returns null for unauthenticated user", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });
});

describe("auth.register validation", () => {
  it("rejects registration with invalid phone format", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.register({
        identifier: "12345",
        password: "password123",
      })
    ).rejects.toThrow();
  });

  it("rejects registration with short password", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.register({
        identifier: "13800000001",
        password: "12345",
      })
    ).rejects.toThrow();
  });

  it("rejects duplicate registration", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.register({
        identifier: "13772503890",
        password: "password123",
      })
    ).rejects.toThrow(/已注册/);
  });
});

describe("SDK authenticateRequest dual-auth support", () => {
  it("createSessionToken produces a valid JWT string", async () => {
    const { sdk } = await import("./_core/sdk");
    const token = await sdk.createSessionToken("30001", {
      name: "管理员",
      expiresInMs: 60000,
    });
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3); // JWT has 3 parts
  });

  it("verifySession decodes custom-auth JWT correctly", async () => {
    const { sdk } = await import("./_core/sdk");
    const token = await sdk.createSessionToken("30001", {
      name: "管理员",
      expiresInMs: 60000,
    });
    const session = await sdk.verifySession(token);
    expect(session).not.toBeNull();
    expect(session?.openId).toBe("30001");
    expect(session?.name).toBe("管理员");
  });

  it("verifySession returns null for invalid token", async () => {
    const { sdk } = await import("./_core/sdk");
    const session = await sdk.verifySession("invalid-token");
    expect(session).toBeNull();
  });

  it("verifySession returns null for empty/null cookie", async () => {
    const { sdk } = await import("./_core/sdk");
    expect(await sdk.verifySession(null)).toBeNull();
    expect(await sdk.verifySession(undefined)).toBeNull();
    expect(await sdk.verifySession("")).toBeNull();
  });
});
