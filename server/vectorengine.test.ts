import { describe, expect, it } from "vitest";

describe("VectorEngine API Key validation", () => {
  it("should have VECTORENGINE_API_KEY configured", () => {
    const key = process.env.VECTORENGINE_API_KEY;
    expect(key).toBeDefined();
    expect(key).not.toBe("");
    expect(key!.startsWith("sk-")).toBe(true);
  });

  it("should have VECTORENGINE_API_URL configured", () => {
    const url = process.env.VECTORENGINE_API_URL;
    expect(url).toBeDefined();
    expect(url).not.toBe("");
    expect(url).toContain("vectorengine");
  });

  it("should be able to call VectorEngine API (lightweight chat test)", async () => {
    const key = process.env.VECTORENGINE_API_KEY;
    const url = process.env.VECTORENGINE_API_URL;
    if (!key || !url) {
      console.warn("Skipping API test: credentials not configured");
      return;
    }

    const response = await fetch(`${url}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Say hello in one word" }],
        max_tokens: 10,
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.choices).toBeDefined();
    expect(data.choices.length).toBeGreaterThan(0);
  }, 30000);
});
