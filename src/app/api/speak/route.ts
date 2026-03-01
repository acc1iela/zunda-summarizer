import { NextRequest, NextResponse } from "next/server";

const VOICEVOX_BASE = process.env.VOICEVOX_BASE_URL ?? "http://localhost:50021";

// ずんだもん（ノーマル）= 3
// 他: あまあま=1, ツンツン=7, セクシー=5, ささやき=22
const SPEAKER_ID = 3;

export async function POST(req: NextRequest) {
  const { text } = await req.json();

  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "テキストが必要なのだ" }, { status: 400 });
  }

  try {
    // Step 1: audio_query でテキスト→音声パラメータJSONを生成
    const queryRes = await fetch(
      `${VOICEVOX_BASE}/audio_query?text=${encodeURIComponent(text)}&speaker=${SPEAKER_ID}`,
      { method: "POST" }
    );

    if (!queryRes.ok) {
      return NextResponse.json(
        { error: "VOICEVOXのクエリ生成に失敗したのだ" },
        { status: 502 }
      );
    }

    const query = await queryRes.json();

    // Step 2: synthesis でWAVバイナリを生成
    const audioRes = await fetch(
      `${VOICEVOX_BASE}/synthesis?speaker=${SPEAKER_ID}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(query),
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
    const isConnectionError = err instanceof TypeError;
    return NextResponse.json(
      {
        error: isConnectionError
          ? "VOICEVOXに繋がらなかったのだ。Dockerが起動しているか確認してほしいのだ"
          : "音声合成でエラーが発生したのだ",
      },
      { status: 503 }
    );
  }
}
