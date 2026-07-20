"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

declare global {
  interface Window {
    Tesseract?: {
      createWorker: (languages: string, oem?: number, options?: { logger?: (message: { status: string; progress: number }) => void }) => Promise<{
        recognize: (image: HTMLCanvasElement) => Promise<{ data: { text: string; confidence: number } }>;
        terminate: () => Promise<void>;
      }>;
    };
  }
}

type Product = {
  id: string;
  brand: string;
  model: string;
  definition: string;
  persona: string;
  price: string;
  size: string;
  colorTemp: string;
  cri: string;
  power: string;
  input: string;
  angle: string;
  screen: string;
  technology: string;
  source: string;
  status: "已核验" | "待核验";
};

const demoProducts: Product[] = [
  {
    id: "demo-1",
    brand: "LumaLab",
    model: "Arc S1",
    definition: "面向单屏办公桌的非对称光桌面照明",
    persona: "长时间办公、空间紧凑、重视桌面整洁的用户",
    price: "¥699",
    size: "45 × 9 × 4 cm",
    colorTemp: "2700–6500K",
    cri: "Ra ≥ 95",
    power: "10W",
    input: "5V / 2A USB-C",
    angle: "灯体 ±25°",
    screen: "0.5–4.0 cm 平面屏",
    technology: "双排 LED + 非对称透镜；前后光路独立调节",
    source: "示例数据（非真实商品）",
    status: "待核验",
  },
  {
    id: "demo-2",
    brand: "Noctis",
    model: "Halo Pro",
    definition: "带环境背光的专业创作屏幕灯",
    persona: "设计师、视频剪辑与对显色要求较高的创作者",
    price: "¥1,299",
    size: "50 × 10 × 5 cm",
    colorTemp: "3000–6500K",
    cri: "Ra ≥ 98",
    power: "15W",
    input: "12V / 1.5A",
    angle: "前灯 ±20° / 背光 30°",
    screen: "平面屏及曲率 ≥ 1000R",
    technology: "分区控光、环境背光、无线旋钮与环境光传感器",
    source: "示例数据（非真实商品）",
    status: "待核验",
  },
  {
    id: "demo-3",
    brand: "Mori",
    model: "Beam Mini",
    definition: "为笔记本与小型显示器设计的便携屏幕灯",
    persona: "学生、移动办公与桌面空间有限的轻量用户",
    price: "¥329",
    size: "32 × 7 × 3 cm",
    colorTemp: "3000 / 4000 / 5000K",
    cri: "Ra ≥ 90",
    power: "5W",
    input: "5V / 1A USB-C",
    angle: "灯体 ±30°",
    screen: "笔记本及 1.5 cm 内平面屏",
    technology: "单排 LED + 遮光格栅；触控调光",
    source: "示例数据（非真实商品）",
    status: "待核验",
  },
];

const emptyProduct: Product = {
  id: "",
  brand: "",
  model: "",
  definition: "",
  persona: "",
  price: "",
  size: "",
  colorTemp: "",
  cri: "",
  power: "",
  input: "",
  angle: "",
  screen: "",
  technology: "",
  source: "",
  status: "待核验",
};

const specRows: { key: keyof Product; label: string }[] = [
  { key: "price", label: "定价" },
  { key: "size", label: "尺寸" },
  { key: "colorTemp", label: "色温" },
  { key: "cri", label: "显色度" },
  { key: "power", label: "功率" },
  { key: "input", label: "额定输入" },
  { key: "angle", label: "角度调节" },
  { key: "screen", label: "适配屏幕" },
];

const targetKeys: (keyof Product)[] = ["brand", "model", "price", "size", "colorTemp", "cri", "power", "input", "angle", "screen", "technology"];

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const value = text.match(pattern)?.[1]?.replace(/[，,;；。]+$/, "").trim();
    if (value) return value;
  }
  return "";
}

function mapOcrToProduct(raw: string): Partial<Product> {
  const text = raw.replace(/\r/g, "").replace(/[ \t]+/g, " ");
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const technologyWords = /非对称|防眩|无频闪|蓝光|背光|光感|自动调光|遥控|旋钮|透镜|格栅|曲面|夹具|悬挂|光学|LED/i;
  const technology = lines.filter((line) => technologyWords.test(line) && line.length < 70).slice(0, 6).join("；");
  return {
    brand: firstMatch(text, [/(?:品牌|Brand)\s*[:：]\s*([^\n]{1,30})/i]),
    model: firstMatch(text, [/(?:产品型号|型号|Model|货号)\s*[:：]?\s*([A-Za-z0-9][A-Za-z0-9_./+\- ]{1,36})/i]),
    price: firstMatch(text, [/[¥￥]\s*([0-9]{2,6}(?:\.[0-9]{1,2})?)/]),
    size: firstMatch(text, [/(?:产品尺寸|灯体尺寸|尺寸|长度)\s*[:：]?\s*([^\n]{2,45})/i, /(\d{2,4}\s*[×xX*]\s*\d{1,4}(?:\s*[×xX*]\s*\d{1,4})?\s*(?:mm|cm|毫米|厘米))/i]),
    colorTemp: firstMatch(text, [/(?:色温范围|色温)\s*[:：]?\s*((?:约\s*)?\d{3,4}\s*(?:K)?\s*(?:[-~—至到]\s*\d{3,4}\s*K?)?)/i, /(\d{3,4}\s*[-~—至到]\s*\d{3,4}\s*K)/i]),
    cri: firstMatch(text, [/(?:显色指数|显色度|CRI|Ra)\s*[:：≥>]*\s*((?:Ra\s*)?(?:≥|>|大于)?\s*\d{2,3})/i]),
    power: firstMatch(text, [/(?:额定功率|灯具功率|功率)\s*[:：]?\s*(\d+(?:\.\d+)?\s*W)/i]),
    input: firstMatch(text, [/(?:额定输入|输入电压|工作电压|输入)\s*[:：]?\s*([^\n]{2,45})/i]),
    angle: firstMatch(text, [/(?:可调角度|角度调节|旋转角度|角度)\s*[:：]?\s*([^\n]{2,45})/i, /((?:±\s*)?\d{1,3}\s*°\s*(?:可调|调节|旋转)?)/]),
    screen: firstMatch(text, [/(?:适配|适用|兼容)\s*(?:屏幕|显示器|屏型)?\s*[:：]?\s*([^\n]{2,55})/i]),
    technology,
  };
}

async function loadOcrEngine() {
  if (window.Tesseract) return window.Tesseract;
  await new Promise<void>((resolve, reject) => {
    const existing = document.getElementById("tesseract-runtime") as HTMLScriptElement | null;
    if (existing) { existing.addEventListener("load", () => resolve(), { once: true }); existing.addEventListener("error", () => reject(new Error("OCR 组件加载失败")), { once: true }); return; }
    const script = document.createElement("script");
    script.id = "tesseract-runtime";
    script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@6/dist/tesseract.min.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("OCR 组件加载失败，请检查网络后重试"));
    document.head.appendChild(script);
  });
  if (!window.Tesseract) throw new Error("OCR 组件未能初始化");
  return window.Tesseract;
}

async function imageToSlices(file: File) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error(`无法读取图片：${file.name}`));
      element.src = objectUrl;
    });
    const scale = Math.min(1, 1600 / image.naturalWidth);
    const width = Math.round(image.naturalWidth * scale);
    const height = Math.round(image.naturalHeight * scale);
    const sliceHeight = 1800;
    const canvases: HTMLCanvasElement[] = [];
    for (let top = 0; top < height; top += sliceHeight) {
      const currentHeight = Math.min(sliceHeight, height - top);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = currentHeight;
      const context = canvas.getContext("2d");
      if (!context) continue;
      context.fillStyle = "#fff";
      context.fillRect(0, 0, width, currentHeight);
      context.drawImage(image, 0, top / scale, image.naturalWidth, currentHeight / scale, 0, 0, width, currentHeight);
      canvases.push(canvas);
    }
    return canvases;
  } finally { URL.revokeObjectURL(objectUrl); }
}

function Field({ label, name, value, onChange, wide = false }: { label: string; name: keyof Product; value: string; onChange: (name: keyof Product, value: string) => void; wide?: boolean }) {
  return (
    <label className={wide ? "field field-wide" : "field"}>
      <span>{label}</span>
      <input value={value} onChange={(e) => onChange(name, e.target.value)} placeholder={`填写${label}`} />
    </label>
  );
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>(demoProducts);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [active, setActive] = useState<Product | null>(null);
  const [modal, setModal] = useState<"extract" | "edit" | null>(null);
  const [draft, setDraft] = useState<Product>(emptyProduct);
  const [url, setUrl] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState(0);
  const [extractStage, setExtractStage] = useState("");
  const [extractionMeta, setExtractionMeta] = useState<{ platform: string; rawText: string; found: number; confidence: number | null; warnings: string[] } | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("screenlight-products-v1");
    if (saved) {
      try { setProducts(JSON.parse(saved)); } catch { /* keep demo records */ }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("screenlight-products-v1", JSON.stringify(products));
  }, [products]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => Object.values(p).some((v) => String(v).toLowerCase().includes(q)));
  }, [products, query]);

  const compared = products.filter((p) => selected.includes(p.id));
  const verified = products.filter((p) => p.status === "已核验").length;

  function openEdit(product?: Product) {
    setExtractionMeta(null);
    setDraft(product ? { ...product } : { ...emptyProduct, id: crypto.randomUUID() });
    setModal("edit");
  }

  function saveProduct(e: FormEvent) {
    e.preventDefault();
    if (!draft.brand.trim() || !draft.model.trim()) return;
    setProducts((current) => current.some((p) => p.id === draft.id)
      ? current.map((p) => p.id === draft.id ? draft : p)
      : [draft, ...current]);
    setExtractionMeta(null);
    setModal(null);
    setNotice("产品信息已保存到当前设备");
  }

  async function extractProduct(e: FormEvent) {
    e.preventDefault();
    if (!url.trim() && images.length === 0) { setNotice("请粘贴商品链接或上传至少一张详情图"); return; }
    setExtracting(true);
    setExtractProgress(0);
    setNotice("");
    let linkProduct: Partial<Product> = {};
    let platform = "图片资料";
    const warnings: string[] = [];
    try {
      if (url.trim()) {
        setExtractStage("正在读取电商链接…");
        try {
          const response = await fetch("/api/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
          const result = await response.json() as { product?: Partial<Product>; platform?: string; warnings?: string[]; error?: string };
          if (!response.ok || !result.product) throw new Error(result.error || "链接读取失败");
          linkProduct = result.product;
          platform = result.platform || "电商页面";
          warnings.push(...(result.warnings || []));
        } catch (error) {
          warnings.push(error instanceof Error ? error.message : "链接读取受限，已继续识别上传图片");
        }
      }

      let rawText = "";
      const confidences: number[] = [];
      if (images.length) {
        setExtractStage("正在加载中文 OCR…");
        const engine = await loadOcrEngine();
        const allSlices: HTMLCanvasElement[] = [];
        for (const file of images) allSlices.push(...await imageToSlices(file));
        if (!allSlices.length) throw new Error("没有可识别的图片内容");
        let currentSlice = 0;
        const worker = await engine.createWorker("chi_sim+eng", 1, { logger: (message) => {
          if (message.status === "recognizing text") setExtractProgress(Math.round(((currentSlice + message.progress) / allSlices.length) * 100));
        }});
        try {
          for (const canvas of allSlices) {
            setExtractStage(`正在识别详情长图 ${currentSlice + 1} / ${allSlices.length}…`);
            const result = await worker.recognize(canvas);
            rawText += `\n${result.data.text}`;
            confidences.push(result.data.confidence);
            currentSlice += 1;
            setExtractProgress(Math.round((currentSlice / allSlices.length) * 100));
          }
        } finally { await worker.terminate(); }
      }

      const ocrProduct = mapOcrToProduct(rawText);
      const combined = { ...linkProduct } as Partial<Product>;
      for (const key of targetKeys) if (ocrProduct[key]) (combined as Record<string, unknown>)[key] = ocrProduct[key];
      if (!combined.brand && platform === "京东") combined.brand = firstMatch(String(linkProduct.model || ""), [/^([^\s]+)\s/]);
      const found = targetKeys.filter((key) => combined[key]).length;
      if (found === 0) throw new Error("未识别出目标字段，请上传更清晰的参数图或手动录入");
      const confidence = confidences.length ? Math.round(confidences.reduce((sum, value) => sum + value, 0) / confidences.length) : null;
      setExtractionMeta({ platform, rawText: rawText.trim(), found, confidence, warnings });
      setDraft({ ...emptyProduct, ...combined, id: crypto.randomUUID(), source: url.trim() || `本地图片：${images.map((file) => file.name).join("、")}`, status: "待核验" });
      setModal("edit");
      setNotice(`已生成 ${found} 个目标字段，请检查后保存`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "识别失败，请改用手动录入");
    } finally { setExtracting(false); setExtractStage(""); }
  }

  function toggleCompare(id: string) {
    setSelected((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : current.length < 4 ? [...current, id] : current);
  }

  function exportCsv() {
    const keys: (keyof Product)[] = ["brand", "model", "definition", "persona", "price", "size", "colorTemp", "cri", "power", "input", "angle", "screen", "technology", "source", "status"];
    const labels = ["品牌", "型号", "产品定义", "用户画像", "定价", "尺寸", "色温", "显色度", "功率", "额定输入", "角度调节", "适配屏幕", "技术拆解", "来源", "核验状态"];
    const quote = (value: string) => `"${String(value).replaceAll('"', '""')}"`;
    const csv = "\ufeff" + [labels.map(quote).join(","), ...products.map((p) => keys.map((key) => quote(p[key])).join(","))].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `屏幕灯竞品库-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="ScreenLight Lab 首页"><span className="brand-mark">SL</span><span>ScreenLight Lab</span></a>
        <nav><a href="#library">产品库</a><a href="#compare">对比分析</a><a href="#method">研究框架</a></nav>
        <button className="ghost-button" onClick={exportCsv}>导出 CSV</button>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><span /> 屏幕灯竞品研究工作台</div>
          <h1>把零散的产品页面，<br />变成可比较的<span>研究证据</span>。</h1>
          <p>导入淘宝、天猫或京东商品链接与详情长图，自动识别型号、价格、光学、电气和结构参数，再人工核验为可比较的研究证据。</p>
          <div className="hero-actions">
            <button className="primary-button" onClick={() => setModal("extract")}>导入链接 / 长图</button>
            <button className="secondary-button" onClick={() => openEdit()}>手动添加产品</button>
          </div>
          <p className="privacy-note">图片 OCR 在当前浏览器完成；商品数据默认保存在当前设备。</p>
        </div>
        <div className="hero-panel" aria-label="产品信息结构示意">
          <div className="panel-head"><span>研究字段覆盖</span><span className="live-dot">完整框架</span></div>
          <div className="field-map">
            <div className="map-card accent"><b>01</b><span>市场层</span><strong>品牌 · 型号 · 定价</strong></div>
            <div className="map-card"><b>02</b><span>策略层</span><strong>产品定义 · 用户画像</strong></div>
            <div className="map-card"><b>03</b><span>性能层</span><strong>光学 · 电气 · 结构规格</strong></div>
            <div className="map-card dark"><b>04</b><span>原理层</span><strong>技术拆解 · 差异证据</strong></div>
          </div>
          <div className="coverage"><span>字段完整度</span><div><i /></div><b>14 / 14</b></div>
        </div>
      </section>

      <section className="summary-strip">
        <div><strong>{products.length}</strong><span>收录产品</span></div>
        <div><strong>{new Set(products.map((p) => p.brand)).size}</strong><span>覆盖品牌</span></div>
        <div><strong>{verified}</strong><span>已核验</span></div>
        <div><strong>{products.length - verified}</strong><span>待核验</span></div>
      </section>

      <section className="library section" id="library">
        <div className="section-title">
          <div><span className="section-no">01 / PRODUCT LIBRARY</span><h2>产品信息库</h2></div>
          <p>统一字段，保留来源，让每条结论都能回溯。</p>
        </div>
        <div className="toolbar">
          <label className="search"><span>⌕</span><input aria-label="搜索产品" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索品牌、型号、定位或规格…" /></label>
          <div className="toolbar-actions"><button className="secondary-button small" onClick={() => openEdit()}>＋ 添加产品</button><button className="primary-button small" onClick={() => setModal("extract")}>导入电商资料</button></div>
        </div>
        <div className="product-grid">
          {filtered.map((product) => (
            <article className="product-card" key={product.id}>
              <div className="card-top"><span className="product-index">{String(products.indexOf(product) + 1).padStart(2, "0")}</span><span className={product.status === "已核验" ? "status verified" : "status"}>{product.status}</span></div>
              <div className="product-name"><span>{product.brand}</span><h3>{product.model}</h3><p>{product.definition}</p></div>
              <div className="mini-specs"><span><small>价格</small><b>{product.price || "—"}</b></span><span><small>色温</small><b>{product.colorTemp || "—"}</b></span><span><small>显色度</small><b>{product.cri || "—"}</b></span></div>
              <div className="card-actions">
                <button onClick={() => setActive(product)}>查看详情 →</button>
                <label className="compare-check"><input type="checkbox" checked={selected.includes(product.id)} onChange={() => toggleCompare(product.id)} /> 对比</label>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="compare section" id="compare">
        <div className="section-title light">
          <div><span className="section-no">02 / COMPARISON</span><h2>横向对比</h2></div>
          <p>在产品卡片中勾选 2–4 款产品，快速识别规格差异。</p>
        </div>
        {compared.length < 2 ? (
          <div className="empty-compare"><span>↔</span><h3>选择至少两款产品开始对比</h3><p>当前已选择 {compared.length} 款，最多可同时比较 4 款。</p></div>
        ) : (
          <div className="table-wrap"><table><thead><tr><th>对比项</th>{compared.map((p) => <th key={p.id}>{p.brand}<strong>{p.model}</strong></th>)}</tr></thead><tbody>{specRows.map((row) => <tr key={row.key}><td>{row.label}</td>{compared.map((p) => <td key={p.id}>{p[row.key] || "—"}</td>)}</tr>)}</tbody></table></div>
        )}
      </section>

      <section className="method section" id="method">
        <div className="section-title"><div><span className="section-no">03 / RESEARCH METHOD</span><h2>从参数到洞察</h2></div><p>把“有什么”继续追问成“为什么这样设计”。</p></div>
        <div className="method-grid">
          <article><b>01</b><h3>采集事实</h3><p>优先记录官网、说明书与实测来源，区分宣传口径和客观规格。</p></article>
          <article><b>02</b><h3>拆解方案</h3><p>沿光学、电气、结构、交互四条路径还原技术实现。</p></article>
          <article><b>03</b><h3>连接用户</h3><p>判断方案解决了谁的什么场景问题，识别真实价值与代价。</p></article>
          <article><b>04</b><h3>形成机会</h3><p>从共性、空白与冲突中提炼可验证的产品机会假设。</p></article>
        </div>
      </section>

      <footer><div className="brand"><span className="brand-mark">SL</span><span>ScreenLight Lab</span></div><p>为屏幕灯研究而生的结构化竞品工作台</p><span>数据仅供研究，请回到来源核验</span></footer>

      {notice && <button className="toast" onClick={() => setNotice("")}>{notice}<span>×</span></button>}

      {modal && <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setModal(null)}>
        <section className="modal" role="dialog" aria-modal="true" aria-label={modal === "extract" ? "从网页提取" : "编辑产品"}>
          <button className="modal-close" aria-label="关闭" onClick={() => setModal(null)}>×</button>
          {modal === "extract" ? <>
            <span className="section-no">ECOMMERCE EXTRACT</span><h2>导入商品链接与详情长图</h2><p className="modal-intro">链接负责补充商品标题、价格和来源；长图 OCR 负责识别详情页中的规格表与卖点。两者可以单独使用，也可以一起导入。</p>
            <form onSubmit={extractProduct} className="extract-form ecommerce-form">
              <label><span><i>01</i> 淘宝 / 天猫 / 京东商品链接（选填）</span><input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://item.taobao.com/… 或 https://item.jd.com/…" /></label>
              <div className="source-divider"><span>＋</span></div>
              <label className="upload-zone">
                <input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(e) => setImages(Array.from(e.target.files || []).slice(0, 12))} />
                <b>02</b><strong>{images.length ? `已选择 ${images.length} 张商品图片` : "上传商品详情长图 / 参数截图"}</strong>
                <small>{images.length ? images.map((file) => file.name).join("、") : "支持 JPG、PNG、WebP，最多 12 张；超长图片会自动分段识别"}</small>
              </label>
              {extracting && <div className="ocr-progress"><div><span>{extractStage}</span><b>{extractProgress}%</b></div><i><em style={{ width: `${Math.max(4, extractProgress)}%` }} /></i><small>首次使用需要加载中文识别模型，可能需要几十秒。</small></div>}
              <button className="primary-button" disabled={extracting}>{extracting ? "正在提取并生成参数…" : "提取并生成目标参数"}</button>
            </form>
            <div className="extract-note"><b>目标字段</b><span>品牌 · 型号 · 定价 · 尺寸 · 色温 · 显色度 · 功率 · 额定输入 · 角度调节 · 适配屏幕 · 技术方案</span><small>电商页面常有登录、滑块或反爬限制。链接读取失败时，上传详情长图仍可继续识别。</small></div>
          </> : <>
            <span className="section-no">PRODUCT RECORD</span><h2>{products.some((p) => p.id === draft.id) ? "编辑产品信息" : "添加产品"}</h2><p className="modal-intro">先记录事实，再补充判断。无法确认的字段可以暂时留空。</p>
            {extractionMeta && <div className="extraction-summary"><div><b>{extractionMeta.found}</b><span>/ {targetKeys.length} 个目标字段已生成</span><em>{extractionMeta.platform}{extractionMeta.confidence !== null ? ` · OCR ${extractionMeta.confidence}%` : ""}</em></div>{extractionMeta.warnings.map((warning) => <p key={warning}>提示：{warning}</p>)}{extractionMeta.rawText && <details><summary>查看 OCR 原始文字</summary><pre>{extractionMeta.rawText}</pre></details>}</div>}
            <form onSubmit={saveProduct} className="product-form">
              <div className="form-grid">
                <Field label="品牌 *" name="brand" value={draft.brand} onChange={(n, v) => setDraft({ ...draft, [n]: v })} />
                <Field label="型号 *" name="model" value={draft.model} onChange={(n, v) => setDraft({ ...draft, [n]: v })} />
                <Field label="产品定义" name="definition" value={draft.definition} onChange={(n, v) => setDraft({ ...draft, [n]: v })} wide />
                <Field label="用户画像" name="persona" value={draft.persona} onChange={(n, v) => setDraft({ ...draft, [n]: v })} wide />
                {specRows.map((row) => <Field key={row.key} label={row.label} name={row.key} value={draft[row.key]} onChange={(n, v) => setDraft({ ...draft, [n]: v })} />)}
                <Field label="技术拆解" name="technology" value={draft.technology} onChange={(n, v) => setDraft({ ...draft, [n]: v })} wide />
                <Field label="信息来源" name="source" value={draft.source} onChange={(n, v) => setDraft({ ...draft, [n]: v })} wide />
              </div>
              <label className="verify-toggle"><input type="checkbox" checked={draft.status === "已核验"} onChange={(e) => setDraft({ ...draft, status: e.target.checked ? "已核验" : "待核验" })} /><span>已对照可信来源核验</span></label>
              <div className="form-actions"><button type="button" className="secondary-button" onClick={() => setModal(null)}>取消</button><button className="primary-button">保存产品</button></div>
            </form>
          </>}
        </section>
      </div>}

      {active && <div className="drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setActive(null)}><aside className="drawer"><button className="modal-close" onClick={() => setActive(null)}>×</button><span className="section-no">PRODUCT DETAIL</span><p className="drawer-brand">{active.brand}</p><h2>{active.model}</h2><span className={active.status === "已核验" ? "status verified" : "status"}>{active.status}</span><div className="detail-section"><small>产品定义</small><p>{active.definition || "暂未填写"}</p></div><div className="detail-section"><small>核心用户</small><p>{active.persona || "暂未填写"}</p></div><div className="detail-specs">{specRows.map((row) => <div key={row.key}><small>{row.label}</small><b>{active[row.key] || "—"}</b></div>)}</div><div className="tech-block"><small>技术拆解</small><p>{active.technology || "暂未填写"}</p></div><div className="source-block"><small>信息来源</small>{active.source.startsWith("http") ? <a href={active.source} target="_blank" rel="noreferrer">打开原始页面 ↗</a> : <span>{active.source || "未记录"}</span>}</div><div className="drawer-actions"><button className="secondary-button" onClick={() => { openEdit(active); setActive(null); }}>编辑</button><button className="danger-button" onClick={() => { setProducts(products.filter((p) => p.id !== active.id)); setActive(null); }}>删除</button></div></aside></div>}
    </main>
  );
}
