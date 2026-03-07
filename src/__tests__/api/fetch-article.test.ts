import { POST } from "@/app/api/fetch-article/route";
import { NextRequest } from "next/server";

// ファイルシステムキャッシュをモック（テストでは常にキャッシュミス）
jest.mock("fs/promises", () => ({
  readFile: jest.fn().mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" })),
  writeFile: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
}));

const mockParse = jest.fn();

jest.mock("jsdom", () => ({
  JSDOM: jest.fn().mockImplementation(() => ({
    window: { document: {} },
  })),
}));

jest.mock("@mozilla/readability", () => ({
  Readability: jest.fn().mockImplementation(() => ({
    parse: mockParse,
  })),
}));

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/fetch-article", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/fetch-article", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParse.mockReturnValue({ title: "テスト記事", textContent: "本文テキスト" });
  });

  it("url が未指定なら 400 を返す", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("url が文字列でなければ 400 を返す", async () => {
    const res = await POST(makeRequest({ url: 123 }));
    expect(res.status).toBe(400);
  });

  it("fetch が失敗したら 400 を返す", async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new TypeError("fetch failed"));
    const res = await POST(makeRequest({ url: "https://example.com/err" }));
    expect(res.status).toBe(400);
  });

  it("HTTP エラーレスポンスなら 400 を返す", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: false, status: 404 });
    const res = await POST(makeRequest({ url: "https://example.com/notfound" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("404");
  });

  it("Readability が本文を抽出できなければ 422 を返す", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      text: jest.fn().mockResolvedValue("<html><body></body></html>"),
    });
    mockParse.mockReturnValueOnce(null);
    const res = await POST(makeRequest({ url: "https://example.com/empty" }));
    expect(res.status).toBe(422);
  });

  it("正常な場合は title と text を返す", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      text: jest.fn().mockResolvedValue("<html><body>content</body></html>"),
    });
    const res = await POST(makeRequest({ url: "https://example.com/ok" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.title).toBe("テスト記事");
    expect(data.text).toBe("本文テキスト");
  });
});
