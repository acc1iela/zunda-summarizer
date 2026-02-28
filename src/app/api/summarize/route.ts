import { NextRequest, NextResponse } from "next/server";
import { Ollama } from "ollama";

const ollama = new Ollama({
  host: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
});

const MODEL = process.env.OLLAMA_MODEL ?? "gemma3:4b";

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
    const response = await ollama.chat({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      stream: false,
    });

    return NextResponse.json({ summary: response.message.content });
  } catch {
    return NextResponse.json(
      {
        error:
          "要約に失敗したのだ。Ollamaが起動しているか確認してほしいのだ（ollama serve）",
      },
      { status: 503 }
    );
  }
}
