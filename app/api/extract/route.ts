import { NextResponse } from "next/server";

function clean(value: unknown) {
  return typeof value === "string"
    ? value.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    : "";
}

function findProduct(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) { const found = findProduct(item); if (found) return found; }
    return null;
  }
  const record = value as Record<string, unknown>;
  const type = record["@type"];
  if (type === "Product" || (Array.isArray(type) && type.includes("Product"))) return record;
  return findProduct(record["@graph"]);
}

function detectPlatform(host: string) {
  if (/jd\.com$|3\.cn$/.test(host)) return "京东";
  if (/taobao\.com$/.test(host)) return "淘宝";
  if (/tmall\.com$/.test(host)) return "天猫";
  return "电商页面";
}

function matchOne(html: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const value = clean(html.match(pattern)?.[1]);
    if (value) return value;
  }
  return "";
}

export async function POST(request: Request) {
  try {
    const { url } = await request.json() as { url?: string };
    if (!url) return NextResponse.json({ error: "请填写商品页面地址" }, { status: 400 });
    const target = new URL(url);
    if (!["http:", "https:"].includes(target.protocol)) throw new Error("仅支持公开网页地址");
    const host = target.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local") || /^127\.|^10\.|^192\.168\.|^169\.254\./.test(host)) throw new Error("不支持读取本地或内网页面");
    const platform = detectPlatform(host);
    const response = await fetch(target, {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "zh-CN,zh;q=0.9",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`${platform}页面暂时无法读取，请上传商品详情长图继续识别`);
    const html = (await response.text()).slice(0, 3_000_000);
    if (/验证码|滑块验证|访问过于频繁|login\.taobao|passport\.jd/i.test(html) && html.length < 400_000) {
      throw new Error(`${platform}触发了登录或访问验证，请上传商品详情长图继续识别`);
    }

    const jsonScripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    let structured: Record<string, unknown> | null = null;
    for (const match of jsonScripts) {
      try { structured = findProduct(JSON.parse(match[1])); if (structured) break; } catch { /* publisher JSON may be malformed */ }
    }
    const meta = (key: string) => clean(html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']*)`, "i"))?.[1]
      || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${key}["']`, "i"))?.[1]);
    const platformTitle = platform === "京东"
      ? matchOne(html, [/["']skuName["']\s*:\s*["']([^"']+)/i, /itemInfo\s*:\s*\{[\s\S]*?["']name["']\s*:\s*["']([^"']+)/i])
      : matchOne(html, [/["']title["']\s*:\s*["']([^"']{6,180})/i, /["']itemTitle["']\s*:\s*["']([^"']+)/i]);
    const title = clean(structured?.name) || platformTitle || meta("og:title") || clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
    const brandValue = structured?.brand;
    const brand = clean(typeof brandValue === "object" && brandValue ? (brandValue as Record<string, unknown>).name : brandValue)
      || matchOne(html, [/["']brandName["']\s*:\s*["']([^"']+)/i, /(?:品牌|Brand)\s*[:：]\s*([^<"']{1,30})/i]);
    const offerValue = Array.isArray(structured?.offers) ? structured?.offers[0] : structured?.offers;
    const offer = typeof offerValue === "object" && offerValue ? offerValue as Record<string, unknown> : {};
    const rawPrice = clean(offer.price || offer.lowPrice) || matchOne(html, [/["'](?:price|p)["']\s*:\s*["']?([0-9]{2,6}(?:\.[0-9]{1,2})?)/i]);
    const currency = clean(offer.priceCurrency);
    const skuFromUrl = platform === "京东" ? target.pathname.match(/\/(\d+)\.html/)?.[1] || "" : target.searchParams.get("id") || "";
    const model = clean(structured?.model || structured?.sku)
      || matchOne(html, [/(?:产品型号|型号)\s*[:：]\s*([^<"']{2,40})/i])
      || title.replace(brand, "").replace(/[|｜—_-].*$/, "").slice(0, 80);
    const warnings: string[] = [];
    if (!structured) warnings.push("该页面未提供标准商品结构数据，已从页面标题与代码线索中提取");
    if (!brand || !model) warnings.push("品牌或型号可能不完整，建议用参数长图补充并人工核验");
    return NextResponse.json({
      platform,
      warnings,
      product: {
        brand,
        model,
        definition: clean(structured?.description) || meta("og:description") || meta("description"),
        price: rawPrice ? `${currency && currency !== "CNY" ? currency : "¥"}${rawPrice}` : "",
        source: response.url,
        technology: skuFromUrl ? `${platform}商品编号：${skuFromUrl}` : "",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "商品页面提取失败" }, { status: 422 });
  }
}
