import { POST } from "@/app/api/speak/route";
import { NextRequest } from "next/server";

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/speak", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/speak", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("text が未指定なら 400 を返す", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("text が文字列でなければ 400 を返す", async () => {
    const res = await POST(makeRequest({ text: 42 }));
    expect(res.status).toBe(400);
  });

  it("VOICEVOX への接続失敗時は 503 を返す", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"));
    const res = await POST(makeRequest({ text: "テストなのだ" }));
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toContain("繋がらなかった");
  });

  it("audio_query が失敗したら 502 を返す", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 400 });
    const res = await POST(makeRequest({ text: "テストなのだ" }));
    expect(res.status).toBe(502);
  });

  it("synthesis が失敗したら 502 を返す", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue({}) })
      .mockResolvedValueOnce({ ok: false, status: 500 });
    const res = await POST(makeRequest({ text: "テストなのだ" }));
    expect(res.status).toBe(502);
  });

  it("正常な場合は WAV バイナリを返す", async () => {
    const mockBuffer = new ArrayBuffer(100);
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue({}) })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValue(mockBuffer),
      });
    const res = await POST(makeRequest({ text: "テストなのだ" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("audio/wav");
  });
});
