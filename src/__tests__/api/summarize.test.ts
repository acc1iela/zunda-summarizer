import { POST } from "@/app/api/summarize/route";
import { NextRequest } from "next/server";

// テストでは常にキャッシュミスになるよう fs/promises をモック
jest.mock("fs/promises", () => ({
  readFile: jest.fn().mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" })),
  writeFile: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
}));

// @swc/jest は mock プレフィックス変数のホイストを行わないため、
// クロージャで包んで mockChat を遅延参照する
const mockChat = jest.fn();

jest.mock("ollama", () => ({
  Ollama: jest.fn().mockImplementation(() => ({
    chat: (...args: unknown[]) => mockChat(...args),
  })),
}));

async function* makeTokenStream(...tokens: string[]) {
  for (const t of tokens) {
    yield { message: { content: t } };
  }
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/summarize", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/summarize", () => {
  beforeEach(() => {
    mockChat.mockReset();
    mockChat.mockResolvedValue(makeTokenStream("要約なのだ"));
  });

  it("text が未指定なら 400 を返す", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("text が文字列でなければ 400 を返す", async () => {
    const res = await POST(makeRequest({ text: 123 }));
    expect(res.status).toBe(400);
  });

  it("正常な場合はストリームで summary を返す", async () => {
    mockChat.mockResolvedValueOnce(makeTokenStream("要約", "なのだ"));
    const res = await POST(makeRequest({ title: "テスト", text: "記事本文" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/plain");
    const text = await res.text();
    expect(text).toBe("要約なのだ");
  });

  it("Ollama 接続失敗時は 503 を返す", async () => {
    mockChat.mockRejectedValueOnce(new TypeError("fetch failed"));
    const res = await POST(makeRequest({ text: "記事本文" }));
    expect(res.status).toBe(503);
  });

  it("Ollama タイムアウト時は 504 を返す", async () => {
    const err = new Error("Timeout");
    err.name = "TimeoutError";
    mockChat.mockRejectedValueOnce(err);
    const res = await POST(makeRequest({ text: "記事本文" }));
    expect(res.status).toBe(504);
  });
});
