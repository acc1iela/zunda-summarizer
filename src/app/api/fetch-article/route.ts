import { NextRequest, NextResponse } from "next/server";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import fs from "fs/promises";
import path from "path";
import os from "os";

// 長すぎる記事はLLMのコンテキスト制限に引っかかるので上限を設ける
const MAX_TEXT_LENGTH = 8000;

// 同一URLの再フェッチを避けるためのファイルキャッシュ（5分TTL、サーバー再起動後も有効）
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_DIR = path.join(os.tmpdir(), "zunda-summarizer-cache");
type CacheEntry = { title: string; text: string; expiresAt: number };

function urlToCacheKey(url: string): string {
  return Buffer.from(url).toString("base64url") + ".json";
}

async function readCacheEntry(url: string): Promise<CacheEntry | null> {
  const filePath = path.join(CACHE_DIR, urlToCacheKey(url));
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const entry: CacheEntry = JSON.parse(content);
    if (Date.now() > entry.expiresAt) {
      await fs.unlink(filePath).catch(() => {}); // 期限切れは削除
      return null;
    }
    return entry;
  } catch {
    return null; // ファイルが存在しない or パースエラー
  }
}

async function writeCacheEntry(
  url: string,
  data: { title: string; text: string }
): Promise<void> {
  const filePath = path.join(CACHE_DIR, urlToCacheKey(url));
  const entry: CacheEntry = { ...data, expiresAt: Date.now() + CACHE_TTL_MS };
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(entry), "utf-8");
  } catch (err) {
    console.warn("[fetch-article] キャッシュ書き込み失敗:", err);
  }
}

export async function POST(req: NextRequest) {
  const { url } = await req.json();

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "URLが必要なのだ" }, { status: 400 });
  }

  const cached = await readCacheEntry(url);
  if (cached) {
    return NextResponse.json({ title: cached.title, text: cached.text });
  }

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });
  } catch (err) {
    console.error("[fetch-article]", err);
    return NextResponse.json(
      { error: "記事の取得に失敗したのだ。URLを確認してほしいのだ" },
      { status: 400 }
    );
  }

  if (!response.ok) {
    return NextResponse.json(
      { error: `記事の取得に失敗したのだ（HTTP ${response.status}）` },
      { status: 400 }
    );
  }

  const html = await response.text();
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (!article) {
    return NextResponse.json(
      { error: "記事の本文を取得できなかったのだ" },
      { status: 422 }
    );
  }

  const text = article.textContent.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_LENGTH);

  await writeCacheEntry(url, { title: article.title, text });

  return NextResponse.json({ title: article.title, text });
}
