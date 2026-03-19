// 鎏光机 - 资产库（重构版）
// 简洁 Excel 表格样式：按集 x 类型（人物/场景/道具）罗列资产
// 支持：从工作流导入 | 导出带提示词的 Excel 表 | 打包下载所有图片
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useProject } from "@/contexts/ProjectContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Download, FileSpreadsheet, Archive, User, Mountain, Package,
  ImageIcon, ExternalLink, ChevronDown, ChevronUp, Loader2, ArrowLeft
} from "lucide-react";
import { Link } from "wouter";
import * as XLSX from "xlsx";
import JSZip from "jszip";

const S = {
  bg: "oklch(0.11 0.005 240)",
  amber: "oklch(0.75 0.17 65)",
  green: "oklch(0.65 0.2 145)",
  blue: "oklch(0.60 0.18 240)",
  orange: "oklch(0.70 0.18 55)",
  dim: "oklch(0.50 0.008 240)",
  text: "oklch(0.92 0.005 60)",
  sub: "oklch(0.70 0.008 240)",
  mono: "'JetBrains Mono', monospace" as const,
  grotesk: "'Space Grotesk', sans-serif" as const,
  border: "oklch(0.22 0.006 240)",
};

type AssetType = "character" | "scene" | "prop";

interface AssetRow {
  id: number;
  name: string;
  type: AssetType;
  episodeId?: string;
  episodeName?: string;
  mjPrompt?: string | null;
  nanoPrompt?: string | null;
  uploadedImageUrl?: string | null;
  mainImageUrl?: string | null;
  multiViewUrls?: string | null;
  splitImages?: Record<string, string>;
}

const TYPE_CONFIG: Record<AssetType, { label: string; color: string; icon: React.ReactNode }> = {
  character: { label: "人物", color: S.blue, icon: <User className="w-3.5 h-3.5" /> },
  scene: { label: "场景", color: S.green, icon: <Mountain className="w-3.5 h-3.5" /> },
  prop: { label: "道具", color: S.orange, icon: <Package className="w-3.5 h-3.5" /> },
};

function AssetThumbnail({ url, alt }: { url?: string | null; alt: string }) {
  if (!url) return (
    <div className="w-16 h-12 rounded flex items-center justify-center flex-shrink-0" style={{ background: "oklch(0.12 0.005 240)", border: "1px solid oklch(0.20 0.006 240)" }}>
      <ImageIcon className="w-4 h-4" style={{ color: "oklch(0.30 0.006 240)" }} />
    </div>
  );
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block flex-shrink-0 group relative">
      <img src={url} alt={alt} className="w-16 h-12 object-cover rounded" style={{ border: "1px solid oklch(0.22 0.006 240)" }} />
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded" style={{ background: "oklch(0 0 0 / 0.5)" }}>
        <ExternalLink className="w-3 h-3" style={{ color: "white" }} />
      </div>
    </a>
  );
}

function AssetCell({ assets, type }: { assets: AssetRow[]; type: AssetType }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? assets : assets.slice(0, 2);

  if (assets.length === 0) {
    return (
      <td className="px-3 py-2 align-top" style={{ borderRight: `1px solid ${S.border}`, minWidth: "200px", verticalAlign: "top" }}>
        <div className="text-xs text-center py-3" style={{ color: "oklch(0.30 0.006 240)" }}>—</div>
      </td>
    );
  }

  return (
    <td className="px-3 py-2 align-top" style={{ borderRight: `1px solid ${S.border}`, minWidth: "200px", verticalAlign: "top" }}>
      <div className="space-y-2">
        {visible.map(asset => {
          const splitImgList = asset.splitImages ? Object.values(asset.splitImages).filter(Boolean) as string[] : [];
          const multiImgList: string[] = [];
          if (asset.multiViewUrls) { try { multiImgList.push(...(JSON.parse(asset.multiViewUrls) as string[])); } catch { /* ignore */ } }
          const allImages = [asset.mainImageUrl, ...splitImgList, ...multiImgList].filter(Boolean) as string[];

          return (
            <div key={asset.id} className="p-2 rounded" style={{ background: "oklch(0.12 0.005 240)", border: "1px solid oklch(0.20 0.006 240)" }}>
              <div className="flex items-start gap-2">
                <AssetThumbnail url={asset.mainImageUrl || asset.uploadedImageUrl} alt={asset.name} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: S.text, fontFamily: S.grotesk }}>{asset.name}</p>
                  {asset.mjPrompt && (
                    <p className="text-[10px] mt-0.5 line-clamp-2" style={{ color: S.dim, fontFamily: S.mono }}>{asset.mjPrompt.slice(0, 80)}{asset.mjPrompt.length > 80 ? "..." : ""}</p>
                  )}
                  {allImages.length > 0 && (
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {allImages.slice(0, 4).map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noreferrer">
                          <img src={url} alt={`视图${i + 1}`} className="w-8 h-6 object-cover rounded" style={{ border: "1px solid oklch(0.22 0.006 240)" }} />
                        </a>
                      ))}
                      {allImages.length > 4 && <span className="text-[10px] self-center" style={{ color: S.dim }}>+{allImages.length - 4}</span>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {assets.length > 2 && (
          <button onClick={() => setExpanded(e => !e)} className="w-full text-[10px] py-1 rounded flex items-center justify-center gap-1" style={{ color: TYPE_CONFIG[type].color, background: "oklch(0.12 0.005 240)", border: "1px solid oklch(0.20 0.006 240)" }}>
            {expanded ? <><ChevronUp className="w-3 h-3" />收起</> : <><ChevronDown className="w-3 h-3" />展开 {assets.length - 2} 个</>}
          </button>
        )}
      </div>
    </td>
  );
}

export default function AssetsPage() {
  const { isAuthenticated } = useAuth();
  const { scriptAnalysis, episodeAssets, characters } = useProject();
  const [downloading, setDownloading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const { data: cloudAssets = [], isLoading } = trpc.assets.list.useQuery(
    {},
    { enabled: isAuthenticated }
  );

  const assetRows = useMemo((): AssetRow[] => {
    const rows: AssetRow[] = [];
    const episodes = scriptAnalysis?.episodes ?? [];

    // 处理人物资产（Character 类型）
    characters.forEach(char => {
      const cloud = char.assetLibId ? cloudAssets.find(a => a.id === char.assetLibId) : null;
      const splitImages: Record<string, string> = {};
      if (char.closeupImageUrl) splitImages.closeup = char.closeupImageUrl;
      if (char.frontImageUrl) splitImages.front = char.frontImageUrl;
      if (char.sideImageUrl) splitImages.side = char.sideImageUrl;
      if (char.backImageUrl) splitImages.back = char.backImageUrl;

      rows.push({
        id: char.assetLibId ?? -(Math.random() * 1e9 | 0),
        name: char.name || "未命名",
        type: "character",
        episodeId: undefined,
        episodeName: "全剧人物",
        mjPrompt: char.promptEn || cloud?.mjPrompt,
        nanoPrompt: char.nanoPrompt || cloud?.mainPrompt,
        uploadedImageUrl: char.uploadedImageUrl || cloud?.uploadedImageUrl,
        mainImageUrl: char.designImageUrl || char.mainImageUrl || cloud?.mainImageUrl,
        splitImages: Object.keys(splitImages).length > 0 ? splitImages : undefined,
      });
    });

    episodeAssets.forEach(ea => {
      const ep = episodes.find(e => e.id === ea.episodeId);
      const cloud = ea.assetLibId ? cloudAssets.find(a => a.id === ea.assetLibId) : null;

      let splitImages: Record<string, string> | undefined;
      if ((ea as any).splitImages) {
        try { splitImages = JSON.parse((ea as any).splitImages as string); } catch { /* ignore */ }
      }

      let mjPromptStr: string | null = null;
      if (ea.promptMJ) {
        try { mjPromptStr = JSON.parse(ea.promptMJ).en ?? ea.promptMJ; } catch { mjPromptStr = ea.promptMJ; }
      } else if (cloud?.mjPrompt) {
        mjPromptStr = cloud.mjPrompt;
      }

      rows.push({
        id: ea.assetLibId ?? -(Math.random() * 1e9 | 0),
        name: ea.name || "未命名",
        type: (ea.type as AssetType) || "character",
        episodeId: ea.episodeId,
        episodeName: ep ? (ep.title || `第 ${ep.number} 集`) : "未知集数",
        mjPrompt: mjPromptStr,
        nanoPrompt: (ea as any).nanoPrompt || cloud?.mainPrompt,
        uploadedImageUrl: (ea as any).uploadedImageUrl || cloud?.uploadedImageUrl,
        mainImageUrl: (ea as any).mainImageUrl || cloud?.mainImageUrl,
        multiViewUrls: cloud?.multiViewUrls,
        splitImages,
      });
    });

    cloudAssets.forEach(ca => {
      const alreadyIn = rows.some(r => r.id === ca.id);
      if (!alreadyIn) {
        rows.push({
          id: ca.id,
          name: ca.name,
          type: ca.type as AssetType,
          episodeId: undefined,
          episodeName: "未分集",
          mjPrompt: ca.mjPrompt,
          nanoPrompt: ca.mainPrompt,
          uploadedImageUrl: ca.uploadedImageUrl,
          mainImageUrl: ca.mainImageUrl,
          multiViewUrls: ca.multiViewUrls,
        });
      }
    });

    return rows;
  }, [episodeAssets, characters, cloudAssets, scriptAnalysis]);

  const episodes = scriptAnalysis?.episodes ?? [];
  const episodeGroups = useMemo(() => {
    const groups: { id: string; name: string; characters: AssetRow[]; scenes: AssetRow[]; props: AssetRow[] }[] = [];

    episodes.forEach(ep => {
      const epAssets = assetRows.filter(r => r.episodeId === ep.id);
      groups.push({
        id: ep.id,
        name: ep.title || `第 ${ep.number} 集`,
        characters: epAssets.filter(a => a.type === "character"),
        scenes: epAssets.filter(a => a.type === "scene"),
        props: epAssets.filter(a => a.type === "prop"),
      });
    });

    const unassigned = assetRows.filter(r => !r.episodeId);
    const globalChars = unassigned.filter(a => a.type === "character");
    const unassignedOthers = unassigned.filter(a => a.type !== "character");
    // 全剧人物单独分组
    if (globalChars.length > 0) {
      groups.unshift({
        id: "global-chars",
        name: "全剧人物",
        characters: globalChars,
        scenes: [],
        props: [],
      });
    }
    if (unassignedOthers.length > 0) {
      groups.push({
        id: "unassigned",
        name: "未分集",
        characters: [],
        scenes: unassignedOthers.filter(a => a.type === "scene"),
        props: unassignedOthers.filter(a => a.type === "prop"),
      });
    }

    return groups;
  }, [assetRows, episodes]);

  const totalAssets = assetRows.length;
  const totalImages = assetRows.reduce((acc, r) => {
    let count = 0;
    if (r.mainImageUrl) count++;
    if (r.splitImages) count += Object.values(r.splitImages).filter(Boolean).length;
    if (r.multiViewUrls) { try { count += (JSON.parse(r.multiViewUrls) as string[]).length; } catch { /* ignore */ } }
    return acc + count;
  }, 0);

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const rows: Record<string, string>[] = [];
      episodeGroups.forEach(group => {
        const allAssets = [...group.characters, ...group.scenes, ...group.props];
        allAssets.forEach(asset => {
          const splitImgs = asset.splitImages ? Object.values(asset.splitImages).filter(Boolean).join(" | ") : "";
          let multiViewImgs = "";
          if (asset.multiViewUrls) { try { multiViewImgs = (JSON.parse(asset.multiViewUrls) as string[]).join(" | "); } catch { /* ignore */ } }

          rows.push({
            "集数": group.name,
            "类型": TYPE_CONFIG[asset.type]?.label ?? asset.type,
            "名称": asset.name,
            "MJ7 提示词": asset.mjPrompt || "",
            "Nano 辅助提示词": asset.nanoPrompt || "",
            "参考图链接": asset.uploadedImageUrl || "",
            "主视图链接": asset.mainImageUrl || "",
            "切分图链接": splitImgs,
            "多视角图链接": multiViewImgs,
          });
        });
      });

      if (rows.length === 0) { toast.error("暂无资产数据"); return; }

      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [
        { wch: 12 }, { wch: 8 }, { wch: 16 }, { wch: 60 }, { wch: 40 },
        { wch: 50 }, { wch: 50 }, { wch: 80 }, { wch: 80 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "资产库");
      XLSX.writeFile(wb, "鎏光机-资产库.xlsx");
      toast.success("Excel 导出成功");
    } catch (err) {
      toast.error(`导出失败：${err instanceof Error ? err.message : "未知错误"}`);
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadAll = async () => {
    setDownloading(true);
    try {
      const zip = new JSZip();
      const allImages: { url: string; filename: string }[] = [];

      assetRows.forEach(asset => {
        const safeName = asset.name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, "_");
        const epName = (asset.episodeName ?? "未分集").replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, "_");
        const prefix = `${epName}/${TYPE_CONFIG[asset.type]?.label ?? asset.type}/${safeName}`;

        if (asset.uploadedImageUrl) allImages.push({ url: asset.uploadedImageUrl, filename: `${prefix}_参考图.jpg` });
        if (asset.mainImageUrl) allImages.push({ url: asset.mainImageUrl, filename: `${prefix}_主视图.jpg` });
        if (asset.splitImages) {
          const labels: Record<string, string> = { closeup: "近景", front: "正视图", side: "侧视图", back: "后视图" };
          Object.entries(asset.splitImages).forEach(([k, v]) => {
            if (v) allImages.push({ url: v, filename: `${prefix}_${labels[k] ?? k}.jpg` });
          });
        }
        if (asset.multiViewUrls) {
          try {
            const urls = JSON.parse(asset.multiViewUrls) as string[];
            urls.forEach((url, i) => allImages.push({ url, filename: `${prefix}_视角${i + 1}.jpg` }));
          } catch { /* ignore */ }
        }
      });

      if (allImages.length === 0) { toast.error("没有可下载的图片"); setDownloading(false); return; }

      toast.info(`正在打包 ${allImages.length} 张图片，请稍候...`);

      const BATCH = 5;
      for (let i = 0; i < allImages.length; i += BATCH) {
        const batch = allImages.slice(i, i + BATCH);
        await Promise.all(batch.map(async ({ url, filename }) => {
          try {
            // 使用后端代理接口绕过 CORS
            const proxyUrl = `/api/download-proxy?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
            const resp = await fetch(proxyUrl);
            if (!resp.ok) return;
            const blob = await resp.blob();
            zip.file(filename, blob);
          } catch { /* skip failed */ }
        }));
      }

      const content = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(content);
      a.download = "鎏光机-资产图片.zip";
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success(`已打包 ${allImages.length} 张图片`);
    } catch (err) {
      toast.error(`打包失败：${err instanceof Error ? err.message : "未知错误"}`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: S.bg }}>
      {/* 顶部导航 */}
      <div className="sticky top-0 z-10 px-6 py-3 flex items-center justify-between" style={{ background: "oklch(0.13 0.005 240)", borderBottom: `1px solid ${S.border}` }}>
        <div className="flex items-center gap-3">
          <Link href="/">
            <button className="flex items-center gap-1.5 text-xs" style={{ color: S.dim }}>
              <ArrowLeft className="w-3.5 h-3.5" />返回工作流
            </button>
          </Link>
          <span style={{ color: "oklch(0.28 0.006 240)" }}>|</span>
          <h1 className="text-sm font-bold" style={{ color: S.text, fontFamily: S.grotesk }}>资产库</h1>
          <Badge className="text-[10px] px-2 py-0" style={{ background: "oklch(0.75 0.17 65 / 0.15)", border: "1px solid oklch(0.75 0.17 65 / 0.3)", color: S.amber }}>
            {totalAssets} 个资产 · {totalImages} 张图片
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleExportExcel} disabled={exporting || totalAssets === 0}
            style={{ background: "oklch(0.65 0.2 145 / 0.1)", border: "1px solid oklch(0.65 0.2 145 / 0.35)", color: S.green }}>
            {exporting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />}
            导出 Excel
          </Button>
          <Button size="sm" variant="outline" onClick={handleDownloadAll} disabled={downloading || totalImages === 0}
            style={{ background: "oklch(0.60 0.18 240 / 0.1)", border: "1px solid oklch(0.60 0.18 240 / 0.35)", color: S.blue }}>
            {downloading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Archive className="w-3.5 h-3.5 mr-1.5" />}
            打包下载图片
          </Button>
        </div>
      </div>

      <div className="px-6 py-6">
        {/* 说明栏 */}
        <div className="mb-4 p-3 rounded text-xs flex items-center gap-3" style={{ background: "oklch(0.13 0.005 240)", border: `1px solid ${S.border}` }}>
          <span style={{ color: S.dim }}>资产库从工作流自动同步。在人物资产（02）、场景资产（02B）、道具资产（02C）中完成生成并点击「导入资产库」后，资产将出现在此表格中。</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: S.amber }} />
          </div>
        ) : episodeGroups.length === 0 ? (
          <div className="text-center py-16 rounded" style={{ background: "oklch(0.13 0.005 240)", border: `1px solid ${S.border}` }}>
            <ImageIcon className="w-10 h-10 mx-auto mb-3" style={{ color: "oklch(0.30 0.006 240)" }} />
            <p className="text-sm" style={{ color: S.dim }}>暂无资产</p>
            <p className="text-xs mt-1" style={{ color: "oklch(0.38 0.008 240)" }}>请先在工作流中完成资产生成并导入资产库</p>
          </div>
        ) : (
          <div className="rounded overflow-x-auto" style={{ border: `1px solid ${S.border}` }}>
            <table className="w-full border-collapse" style={{ background: "oklch(0.13 0.005 240)" }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${S.border}` }}>
                  <th className="px-4 py-3 text-left text-xs font-bold" style={{ color: S.amber, fontFamily: S.mono, width: "140px", borderRight: `1px solid ${S.border}` }}>集数</th>
                  <th className="px-3 py-3 text-left text-xs font-bold" style={{ color: TYPE_CONFIG.character.color, fontFamily: S.mono, minWidth: "200px", borderRight: `1px solid ${S.border}` }}>
                    <div className="flex items-center gap-1.5">{TYPE_CONFIG.character.icon}人物</div>
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-bold" style={{ color: TYPE_CONFIG.scene.color, fontFamily: S.mono, minWidth: "200px", borderRight: `1px solid ${S.border}` }}>
                    <div className="flex items-center gap-1.5">{TYPE_CONFIG.scene.icon}场景</div>
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-bold" style={{ color: TYPE_CONFIG.prop.color, fontFamily: S.mono, minWidth: "200px" }}>
                    <div className="flex items-center gap-1.5">{TYPE_CONFIG.prop.icon}道具</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {episodeGroups.map((group, idx) => (
                  <tr key={group.id} style={{ borderBottom: `1px solid ${S.border}`, background: idx % 2 === 0 ? "oklch(0.14 0.005 240)" : "oklch(0.13 0.005 240)" }}>
                    <td className="px-4 py-3 align-top" style={{ borderRight: `1px solid ${S.border}`, verticalAlign: "top", width: "140px" }}>
                      <p className="text-sm font-bold" style={{ color: S.text, fontFamily: S.grotesk }}>{group.name}</p>
                      <div className="flex flex-col gap-0.5 mt-1">
                        {group.characters.length > 0 && <span className="text-[10px]" style={{ color: TYPE_CONFIG.character.color, fontFamily: S.mono }}>{group.characters.length} 人物</span>}
                        {group.scenes.length > 0 && <span className="text-[10px]" style={{ color: TYPE_CONFIG.scene.color, fontFamily: S.mono }}>{group.scenes.length} 场景</span>}
                        {group.props.length > 0 && <span className="text-[10px]" style={{ color: TYPE_CONFIG.prop.color, fontFamily: S.mono }}>{group.props.length} 道具</span>}
                      </div>
                    </td>
                    <AssetCell assets={group.characters} type="character" />
                    <AssetCell assets={group.scenes} type="scene" />
                    <AssetCell assets={group.props} type="prop" />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-4 text-[10px]" style={{ color: "oklch(0.40 0.008 240)" }}>
          <span>· 点击缩略图可在新标签页查看原图</span>
          <span>· 「导出 Excel」包含所有资产名称、提示词和图片链接</span>
          <span>· 「打包下载」将按集数/类型分文件夹打包所有图片为 ZIP</span>
        </div>
      </div>
    </div>
  );
}
