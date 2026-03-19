import { describe, it, expect } from "vitest";
import { parseScriptFile } from "./lib/scriptParser";

describe("scriptParser", () => {
  describe("TXT parsing", () => {
    it("should split text by episode markers (第X集)", async () => {
      const text = `第1集
场景1：城市街道，夜晚
男主角走在雨中，表情忧郁。

第2集
场景1：咖啡馆，白天
女主角坐在窗边，翻看手机。

第3集
场景1：办公室
两人在会议室相遇。`;
      const buffer = Buffer.from(text, "utf-8");
      const episodes = await parseScriptFile(buffer, "txt", "test.txt");
      
      expect(episodes).toHaveLength(3);
      expect(episodes[0].episodeNumber).toBe(1);
      expect(episodes[1].episodeNumber).toBe(2);
      expect(episodes[2].episodeNumber).toBe(3);
      expect(episodes[0].scriptText).toContain("城市街道");
      expect(episodes[1].scriptText).toContain("咖啡馆");
      expect(episodes[2].scriptText).toContain("办公室");
    });

    it("should split text by EP X markers", async () => {
      const text = `EP 1
Scene 1: City street at night.
The hero walks in the rain.

EP 2
Scene 1: Coffee shop during the day.
The heroine sits by the window.`;
      const buffer = Buffer.from(text, "utf-8");
      const episodes = await parseScriptFile(buffer, "txt", "test.txt");
      
      expect(episodes).toHaveLength(2);
      expect(episodes[0].episodeNumber).toBe(1);
      expect(episodes[1].episodeNumber).toBe(2);
      expect(episodes[0].scriptText).toContain("City street");
      expect(episodes[1].scriptText).toContain("Coffee shop");
    });

    it("should split text by Episode X markers", async () => {
      const text = `Episode 1
Opening scene in a dark alley.

Episode 2
Morning at the beach house.`;
      const buffer = Buffer.from(text, "utf-8");
      const episodes = await parseScriptFile(buffer, "txt", "test.txt");
      
      expect(episodes).toHaveLength(2);
      expect(episodes[0].episodeNumber).toBe(1);
      expect(episodes[1].episodeNumber).toBe(2);
    });

    it("should treat text without markers as episode 1", async () => {
      const text = `这是一段没有集数标记的剧本内容。
场景1：城市街道。
男主角出场。`;
      const buffer = Buffer.from(text, "utf-8");
      const episodes = await parseScriptFile(buffer, "txt", "test.txt");
      
      expect(episodes).toHaveLength(1);
      expect(episodes[0].episodeNumber).toBe(1);
      expect(episodes[0].scriptText).toContain("城市街道");
    });

    it("should handle markdown-style headers (# 第X集)", async () => {
      const text = `# 第1集
场景描述...

## 第2集
另一个场景...`;
      const buffer = Buffer.from(text, "utf-8");
      const episodes = await parseScriptFile(buffer, "txt", "test.txt");
      
      expect(episodes).toHaveLength(2);
      expect(episodes[0].episodeNumber).toBe(1);
      expect(episodes[1].episodeNumber).toBe(2);
    });

    it("should include charCount for each episode", async () => {
      const text = `第1集
短内容

第2集
这是一段比较长的内容，包含更多的文字描述。`;
      const buffer = Buffer.from(text, "utf-8");
      const episodes = await parseScriptFile(buffer, "txt", "test.txt");
      
      expect(episodes).toHaveLength(2);
      expect(episodes[0].charCount).toBe(episodes[0].scriptText.length);
      expect(episodes[1].charCount).toBe(episodes[1].scriptText.length);
      expect(episodes[1].charCount).toBeGreaterThan(episodes[0].charCount);
    });

    it("should skip empty episodes", async () => {
      const text = `第1集
有内容的第一集

第2集

第3集
有内容的第三集`;
      const buffer = Buffer.from(text, "utf-8");
      const episodes = await parseScriptFile(buffer, "txt", "test.txt");
      
      // Episode 2 is empty, should be skipped
      expect(episodes).toHaveLength(2);
      expect(episodes[0].episodeNumber).toBe(1);
      expect(episodes[1].episodeNumber).toBe(3);
    });
  });

  describe("Excel parsing", () => {
    it("should parse single-sheet Excel with episode markers", async () => {
      // Create a simple xlsx buffer using the xlsx library
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      const data = [
        ["第1集"],
        ["场景1：城市街道"],
        ["男主角出场"],
        [""],
        ["第2集"],
        ["场景1：咖啡馆"],
        ["女主角出场"],
      ];
      const ws = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, "剧本");
      const buffer = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
      
      const episodes = await parseScriptFile(buffer, "xlsx", "test.xlsx");
      
      expect(episodes).toHaveLength(2);
      expect(episodes[0].episodeNumber).toBe(1);
      expect(episodes[1].episodeNumber).toBe(2);
      expect(episodes[0].scriptText).toContain("城市街道");
      expect(episodes[1].scriptText).toContain("咖啡馆");
    });

    it("should parse multi-sheet Excel (one sheet per episode)", async () => {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      
      const ws1 = XLSX.utils.aoa_to_sheet([["场景1：城市街道"], ["男主角出场"]]);
      XLSX.utils.book_append_sheet(wb, ws1, "第1集");
      
      const ws2 = XLSX.utils.aoa_to_sheet([["场景1：咖啡馆"], ["女主角出场"]]);
      XLSX.utils.book_append_sheet(wb, ws2, "第2集");
      
      const ws3 = XLSX.utils.aoa_to_sheet([["场景1：办公室"], ["两人相遇"]]);
      XLSX.utils.book_append_sheet(wb, ws3, "第3集");
      
      const buffer = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
      
      const episodes = await parseScriptFile(buffer, "xlsx", "test.xlsx");
      
      expect(episodes).toHaveLength(3);
      expect(episodes[0].episodeNumber).toBe(1);
      expect(episodes[1].episodeNumber).toBe(2);
      expect(episodes[2].episodeNumber).toBe(3);
    });

    it("should parse sheets named with EP prefix", async () => {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      
      const ws1 = XLSX.utils.aoa_to_sheet([["Scene 1: City street"]]);
      XLSX.utils.book_append_sheet(wb, ws1, "EP1");
      
      const ws2 = XLSX.utils.aoa_to_sheet([["Scene 1: Coffee shop"]]);
      XLSX.utils.book_append_sheet(wb, ws2, "EP2");
      
      const buffer = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
      
      const episodes = await parseScriptFile(buffer, "xlsx", "test.xlsx");
      
      expect(episodes).toHaveLength(2);
      expect(episodes[0].episodeNumber).toBe(1);
      expect(episodes[1].episodeNumber).toBe(2);
    });

    it("should parse sheets named with just numbers", async () => {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      
      const ws1 = XLSX.utils.aoa_to_sheet([["第一集内容"]]);
      XLSX.utils.book_append_sheet(wb, ws1, "1");
      
      const ws2 = XLSX.utils.aoa_to_sheet([["第二集内容"]]);
      XLSX.utils.book_append_sheet(wb, ws2, "2");
      
      const buffer = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
      
      const episodes = await parseScriptFile(buffer, "xlsx", "test.xlsx");
      
      expect(episodes).toHaveLength(2);
      expect(episodes[0].episodeNumber).toBe(1);
      expect(episodes[1].episodeNumber).toBe(2);
    });

    it("should handle multi-column Excel rows", async () => {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      const data = [
        ["镜头号", "场景", "对白", "动作"],
        ["第1集", "", "", ""],
        ["1", "城市街道", "你好", "男主角走路"],
        ["2", "咖啡馆", "再见", "女主角转身"],
      ];
      const ws = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, "剧本");
      const buffer = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
      
      const episodes = await parseScriptFile(buffer, "xlsx", "test.xlsx");
      
      expect(episodes).toHaveLength(1);
      expect(episodes[0].episodeNumber).toBe(1);
      expect(episodes[0].scriptText).toContain("城市街道");
    });
  });

  describe("Unsupported formats", () => {
    it("should throw for unsupported file extensions", async () => {
      const buffer = Buffer.from("test content");
      await expect(parseScriptFile(buffer, "pdf", "test.pdf")).rejects.toThrow("不支持的文件格式");
    });
  });
});
