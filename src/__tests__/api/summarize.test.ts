import { POST } from "@/app/api/summarize/route";
import { NextRequest } from "next/server";

// @swc/jest は mock プレフィックス変数のホイストを行わないため、
// クロージャで包んで mockChat を遅延参照する
const mockChat = jest.fn();

jest.mock("ollama", () => ({
  Ollama: jest.fn().mockImplementation(() => ({
    chat: (...args: unknown[]) => mockChat(...args),
  })),
}));

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/summarize", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/summarize", () => {
  beforeEach(() => {
    mockChat.mockReset();
    mockChat.mockResolvedValue({ message: { content: "要約なのだ" } });
  });

  it("text が未指定なら 400 を返す", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("text が文字列でなければ 400 を返す", async () => {
    const res = await POST(makeRequest({ text: 123 }));
    expect(res.status).toBe(400);
  });

  it("正常な場合は summary を返す", async () => {
    const res = await POST(makeRequest({ title: "テスト", text: "記事本文" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.summary).toBe("要約なのだ");
  });

  it("Ollama 接続失敗時は 503 を返す", async () => {
    mockChat.mockRejectedValueOnce(new TypeError("fetch failed"));
    const res = await POST(makeRequest({ text: "記事本文" }));
    expect(res.status).toBe(503);
  });

  it("Ollama のレスポンスが不正なら 502 を返す", async () => {
    mockChat.mockResolvedValueOnce({ message: { content: null } });
    const res = await POST(makeRequest({ text: "記事本文" }));
    expect(res.status).toBe(502);
  });
});
