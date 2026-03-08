/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Home from "@/app/page";

// jsdom は Blob URL を生成できないためモックする
global.URL.createObjectURL = jest.fn(() => "blob:mock-audio");
global.URL.revokeObjectURL = jest.fn();

const mockFetch = jest.fn();

beforeAll(() => {
  global.fetch = mockFetch;
});

beforeEach(() => {
  mockFetch.mockReset();
  jest.mocked(URL.createObjectURL).mockClear();
  jest.mocked(URL.revokeObjectURL).mockClear();
});

describe("Home", () => {
  it("初期状態でフォームと送信ボタンが表示される", () => {
    render(<Home />);
    expect(screen.getByLabelText("記事のURL")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "要約するのだ" })).toBeInTheDocument();
  });

  it("URLが空のとき送信ボタンが無効になる", () => {
    render(<Home />);
    expect(screen.getByRole("button", { name: "要約するのだ" })).toBeDisabled();
  });

  it("送信中は「処理中...」ボタンとステータスが表示される", async () => {
    const user = userEvent.setup();
    // 一生 resolve しない fetch でローディング状態を維持
    mockFetch.mockReturnValue(new Promise(() => {}));

    render(<Home />);
    await user.type(screen.getByLabelText("記事のURL"), "https://example.com");
    await user.click(screen.getByRole("button", { name: "要約するのだ" }));

    expect(screen.getByRole("button", { name: "処理中..." })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("記事を取得中なのだ...");
  });

  it("記事取得に失敗した場合、エラーが表示される", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "記事の取得に失敗したのだ。URLを確認してほしいのだ" }),
    });

    render(<Home />);
    await user.type(screen.getByLabelText("記事のURL"), "https://example.com");
    await user.click(screen.getByRole("button", { name: "要約するのだ" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "記事の取得に失敗したのだ。URLを確認してほしいのだ"
      );
    });
  });

  it("要約に失敗した場合、エラーが表示される", async () => {
    const user = userEvent.setup();
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ title: "テスト記事", text: "テスト本文" }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Ollamaに接続できなかったのだ。ollama serve を確認してほしいのだ" }),
      });

    render(<Home />);
    await user.type(screen.getByLabelText("記事のURL"), "https://example.com");
    await user.click(screen.getByRole("button", { name: "要約するのだ" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Ollamaに接続できなかったのだ");
    });
  });

  it("エラー発生時、エラー要素にフォーカスが移動する", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "記事の取得に失敗したのだ。URLを確認してほしいのだ" }),
    });

    render(<Home />);
    await user.type(screen.getByLabelText("記事のURL"), "https://example.com");
    await user.click(screen.getByRole("button", { name: "要約するのだ" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(document.activeElement).toBe(screen.getByRole("alert"));
  });

  it("すべて成功すると要約テキストと音声プレーヤーが表示される", async () => {
    const user = userEvent.setup();
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ title: "テスト記事タイトル", text: "テスト本文" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ summary: "これはテストの要約なのだ" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(["audio"], { type: "audio/wav" }),
      });

    render(<Home />);
    await user.type(screen.getByLabelText("記事のURL"), "https://example.com");
    await user.click(screen.getByRole("button", { name: "要約するのだ" }));

    await waitFor(() => {
      expect(screen.getByText("これはテストの要約なのだ")).toBeInTheDocument();
    });
    expect(screen.getByText("テスト記事タイトル")).toBeInTheDocument();
    expect(document.querySelector("audio")).toBeInTheDocument();
  });
});
