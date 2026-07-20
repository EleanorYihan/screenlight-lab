import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const host = (await headers()).get("host") || "localhost:3000";
  const base = new URL(`${host.includes("localhost") ? "http" : "https"}://${host}`);
  const title = "ScreenLight Lab｜屏幕灯竞品研究工作台";
  const description = "提取、整理、核验并对比屏幕灯产品信息，从参数走向产品洞察。";
  const image = new URL("/og.png", base).toString();
  return {
    metadataBase: base,
    title,
    description,
    openGraph: { title, description, images: [{ url: image, width: 1732, height: 908 }], type: "website" },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
