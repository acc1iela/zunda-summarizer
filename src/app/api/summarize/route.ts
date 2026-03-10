import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { NextRequest, NextResponse } from "next/server";
import { Ollama } from "ollama";
import { isNonEmptyString } from "@/lib/validate";

const ollama = new Ollama({
  host: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
});

const MODEL = process.env.OLLAMA_MODEL ?? "gemma3:4b";

const OLLAMA_TIMEOUT_MS = 120_000;

// --- 要約キャッシュ（L1: メモリ / L2: ファイル、TTL 1時間） ---
const SUMMARY_CACHE_TTL_MS = 60 * 60 * 1000;
const SUMMARY_CACHE_DIR = path.join(os.tmpdir(), "zunda-summarizer-summary-cache");
type SummaryCacheEntry = { summary: string; expiresAt: number };

const summaryCacheDirReady = fs.mkdir(SUMMARY_CACHE_DIR, { recursive: true }).catch((err) => {
  console.warn("[summarize] キャッシュディレクトリの作成に失敗:", err);
});

const summaryMemoryCache = new Map<string, SummaryCacheEntry>();

function toSummaryCacheKey(title: string, text: string): string {
  return (
    crypto.createHash("sha256").update(`${title}\0${text}`).digest("base64url") + ".json"
  );
}

async function readSummaryCacheEntry(key: string): Promise<string | null> {
  const mem = summaryMemoryCache.get(key);
  if (mem) {
    if (Date.now() <= mem.expiresAt) return mem.summary;
    summaryMemoryCache.delete(key);
  }
  const filePath = path.join(SUMMARY_CACHE_DIR, key);
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const entry: SummaryCacheEntry = JSON.parse(content);
    if (Date.now() > entry.expiresAt) {
      await fs.unlink(filePath).catch(() => {});
      return null;
    }
    summaryMemoryCache.set(key, entry);
    return entry.summary;
  } catch {
    return null;
  }
}

async function writeSummaryCacheEntry(key: string, summary: string): Promise<void> {
  const entry: SummaryCacheEntry = { summary, expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS };
  summaryMemoryCache.set(key, entry);
  const filePath = path.join(SUMMARY_CACHE_DIR, key);
  try {
    await summaryCacheDirReady;
    await fs.writeFile(filePath, JSON.stringify(entry), "utf-8");
  } catch (err) {
    console.warn("[summarize] キャッシュ書き込み失敗:", err);
  }
}
// --- End Cache ---

export async function POST(req: NextRequest) {
  const { title, text } = await req.json();

  if (!isNonEmptyString(text)) {
    return NextResponse.json({ error: "テキストが必要なのだ" }, { status: 400 });
  }

  const cacheKey = toSummaryCacheKey(title ?? "", text);
  const cached = await readSummaryCacheEntry(cacheKey);
  if (cached) {
    return NextResponse.json({ summary: cached });
  }

  const prompt = `あなたはずんだもんです。語尾は「〜なのだ」「〜のだ」を使います。
以下の技術記事を、ずんだもんの口調で3〜5文に要約してください。
専門用語はそのまま使い、わかりやすく説明してください。日本語で答えてください。

記事タイトル: ${title ?? "不明"}
記事内容:
${text}

要約（ずんだもんの口調で）:`;

  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => {
        const err = new Error(`Timeout after ${OLLAMA_TIMEOUT_MS}ms`);
        err.name = "TimeoutError";
        reject(err);
      }, OLLAMA_TIMEOUT_MS)
    );
    const response = await Promise.race([
      ollama.chat({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        stream: false,
      }),
      timeoutPromise,
    ]);

    const content = response.message?.content;
    if (typeof content !== "string") {
      console.error("[summarize] Unexpected response shape:", response);
      return NextResponse.json(
        { error: "モデルの応答が不正なのだ" },
        { status: 502 }
      );
    }

    await writeSummaryCacheEntry(cacheKey, content);

    return NextResponse.json({ summary: content });
  } catch (err) {
    console.error("[summarize]", err);
    const isTimeoutError = err instanceof Error && err.name === "TimeoutError";
    const isConnectionError = !isTimeoutError && err instanceof TypeError;
    return NextResponse.json(
      {
        error: isTimeoutError
          ? `Ollamaの応答が${OLLAMA_TIMEOUT_MS / 1000}秒でタイムアウトしたのだ。モデルが重すぎる可能性があるのだ`
          : isConnectionError
          ? "Ollamaに接続できなかったのだ。ollama serve を確認してほしいのだ"
          : "要約に失敗したのだ。Ollamaが起動しているか確認してほしいのだ（ollama serve）",
      },
      { status: isTimeoutError ? 504 : 503 }
    );
  }
}
