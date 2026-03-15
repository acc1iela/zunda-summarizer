import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { NextRequest, NextResponse } from "next/server";
import { isNonEmptyString } from "@/lib/validate";

const VOICEVOX_BASE = process.env.VOICEVOX_BASE_URL ?? "http://localhost:50021";

// --- 音声キャッシュ（L1: メモリ / L2: バイナリファイル、TTL 24時間） ---
// 同じテキストの音声合成は結果が一定なので長めのTTLを設定する
const SPEAK_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const SPEAK_CACHE_DIR = path.join(os.tmpdir(), "zunda-summarizer-speak-cache");
type SpeakCacheEntry = { buffer: Buffer; expiresAt: number };

const speakCacheDirReady = fs.mkdir(SPEAK_CACHE_DIR, { recursive: true }).catch((err) => {
  console.warn("[speak] キャッシュディレクトリの作成に失敗:", err);
});

const MEMORY_CACHE_MAX_SIZE = 100;
const speakMemoryCache = new Map<string, SpeakCacheEntry>();

// Map の挿入順を利用した LRU eviction（外部ライブラリ不要）
function lruSet<V>(map: Map<string, V>, key: string, value: V, maxSize: number): void {
  if (map.has(key)) map.delete(key);
  map.set(key, value);
  if (map.size > maxSize) map.delete(map.keys().next().value!);
}

function toSpeakCacheKey(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

async function readSpeakCache(key: string): Promise<Buffer | null> {
  const mem = speakMemoryCache.get(key);
  if (mem) {
    if (Date.now() <= mem.expiresAt) return mem.buffer;
    speakMemoryCache.delete(key);
  }
  const filePath = path.join(SPEAK_CACHE_DIR, key + ".wav");
  try {
    const stat = await fs.stat(filePath);
    const expiresAt = stat.mtimeMs + SPEAK_CACHE_TTL_MS;
    if (Date.now() > expiresAt) {
      await fs.unlink(filePath).catch(() => {});
      return null;
    }
    const buffer = await fs.readFile(filePath);
    lruSet(speakMemoryCache, key, { buffer, expiresAt }, MEMORY_CACHE_MAX_SIZE);
    return buffer;
  } catch {
    return null;
  }
}

async function writeSpeakCache(key: string, buffer: Buffer): Promise<void> {
  lruSet(speakMemoryCache, key, { buffer, expiresAt: Date.now() + SPEAK_CACHE_TTL_MS }, MEMORY_CACHE_MAX_SIZE);
  const filePath = path.join(SPEAK_CACHE_DIR, key + ".wav");
  try {
    await speakCacheDirReady;
    await fs.writeFile(filePath, buffer);
  } catch (err) {
    console.warn("[speak] キャッシュ書き込み失敗:", err);
  }
}
// --- End Cache ---

// VOICEVOX /audio_query レスポンスの型定義
type Mora = {
  text: string;
  consonant?: string;
  consonant_length?: number;
  vowel: string;
  vowel_length: number;
  pitch: number;
};

type AccentPhrase = {
  moras: Mora[];
  accent: number;
  pause_mora?: Mora | null;
  is_interrogative?: boolean;
};

type AudioQuery = {
  accent_phrases: AccentPhrase[];
  speedScale: number;
  pitchScale: number;
  intonationScale: number;
  volumeScale: number;
  prePhonemeLength: number;
  postPhonemeLength: number;
  outputSamplingRate: number;
  outputStereo: boolean;
  kana?: string;
};

// ずんだもん（ノーマル）= 3
// 他: あまあま=1, ツンツン=7, セクシー=5, ささやき=22
const SPEAKER_ID = 3;

// URL長制限対策。要約は通常 200-400 字なのでこの上限で切れることはほぼない
const MAX_SPEAK_LENGTH = 500;

const VOICEVOX_TIMEOUT_MS = 30_000;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエストの形式が正しくないのだ" }, { status: 400 });
  }
  const { text } = body as { text?: unknown };

  if (!isNonEmptyString(text)) {
    return NextResponse.json({ error: "テキストが必要なのだ" }, { status: 400 });
  }

  const speakText = text.slice(0, MAX_SPEAK_LENGTH);

  const cacheKey = toSpeakCacheKey(speakText);
  const cached = await readSpeakCache(cacheKey);
  if (cached) {
    return new NextResponse(cached.buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": cached.byteLength.toString(),
      },
    });
  }

  try {
    // Step 1: audio_query でテキスト→音声パラメータJSONを生成
    const queryRes = await fetch(
      `${VOICEVOX_BASE}/audio_query?text=${encodeURIComponent(speakText)}&speaker=${SPEAKER_ID}`,
      { method: "POST", signal: AbortSignal.timeout(VOICEVOX_TIMEOUT_MS) }
    );

    if (!queryRes.ok) {
      return NextResponse.json(
        { error: "VOICEVOXのクエリ生成に失敗したのだ" },
        { status: 502 }
      );
    }

    const query = (await queryRes.json()) as AudioQuery;

    // Step 2: synthesis でWAVバイナリを生成
    const audioRes = await fetch(
      `${VOICEVOX_BASE}/synthesis?speaker=${SPEAKER_ID}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(query),
        signal: AbortSignal.timeout(VOICEVOX_TIMEOUT_MS),
      }
    );

    if (!audioRes.ok) {
      return NextResponse.json(
        { error: "VOICEVOXの音声合成に失敗したのだ" },
        { status: 502 }
      );
    }

    const audioBuffer = await audioRes.arrayBuffer();
    const audioBytes = Buffer.from(audioBuffer);

    // バックグラウンドでキャッシュに保存（レスポンスをブロックしない）
    writeSpeakCache(cacheKey, audioBytes).catch(() => {});

    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": audioBuffer.byteLength.toString(),
      },
    });
  } catch (err) {
    console.error("[speak]", err);
    const isTimeoutError = err instanceof Error && err.name === "TimeoutError";
    const isConnectionError = !isTimeoutError && err instanceof TypeError;
    return NextResponse.json(
      {
        error: isTimeoutError
          ? `VOICEVOXの応答が${VOICEVOX_TIMEOUT_MS / 1000}秒でタイムアウトしたのだ`
          : isConnectionError
          ? "VOICEVOXに繋がらなかったのだ。Dockerが起動しているか確認してほしいのだ"
          : "音声合成でエラーが発生したのだ。もう一度試してほしいのだ",
      },
      { status: isTimeoutError ? 504 : 503 }
    );
  }
}
