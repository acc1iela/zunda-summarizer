import { NextRequest, NextResponse } from "next/server";
import { Ollama } from "ollama";

const ollama = new Ollama({
  host: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
});

const MODEL = process.env.OLLAMA_MODEL ?? "gemma3:4b";

const OLLAMA_TIMEOUT_MS = 120_000;

export async function POST(req: NextRequest) {
  const { title, text } = await req.json();

  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "テキストが必要なのだ" }, { status: 400 });
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
