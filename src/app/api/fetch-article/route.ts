import { NextRequest, NextResponse } from "next/server";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

// 長すぎる記事はLLMのコンテキスト制限に引っかかるので上限を設ける
const MAX_TEXT_LENGTH = 8000;

export async function POST(req: NextRequest) {
  const { url } = await req.json();

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "URLが必要なのだ" }, { status: 400 });
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

  return NextResponse.json({ title: article.title, text });
}
