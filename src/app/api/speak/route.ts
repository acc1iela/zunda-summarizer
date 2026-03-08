import { NextRequest, NextResponse } from "next/server";
import { isNonEmptyString } from "@/lib/validate";

const VOICEVOX_BASE = process.env.VOICEVOX_BASE_URL ?? "http://localhost:50021";

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
  const { text } = await req.json();

  if (!isNonEmptyString(text)) {
    return NextResponse.json({ error: "テキストが必要なのだ" }, { status: 400 });
  }

  const speakText = text.slice(0, MAX_SPEAK_LENGTH);

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
