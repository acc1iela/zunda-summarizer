import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  if (request.method === "POST") {
    const origin = request.headers.get("origin");
    // Origin ヘッダーが存在する場合（= ブラウザからのリクエスト）のみ検証
    // サーバー間通信など Origin が付かないケースは通過させる
    if (origin !== null) {
      const host = request.headers.get("host") ?? "localhost:3000";
      const proto = request.headers.get("x-forwarded-proto") ?? "http";
      const expectedOrigin = `${proto}://${host}`;
      if (origin !== expectedOrigin) {
        return NextResponse.json({ error: "不正なリクエスト元なのだ" }, { status: 403 });
      }
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
