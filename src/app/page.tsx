"use client";

import { useState } from "react";
import { useSummarizer, STEP_LABELS } from "@/hooks/useSummarizer";

export default function Home() {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const {
    step,
    title,
    summary,
    audioUrl,
    captionUrl,
    error,
    isLoading,
    downloadHref,
    errorRef,
    handleSubmit,
    handleCancel,
    handleRerun,
  } = useSummarizer(url);

  return (
    <main className="min-h-screen bg-gradient-to-b from-green-50 to-emerald-50 dark:from-gray-900 dark:to-gray-800 px-4 py-12">
      <div className="max-w-2xl mx-auto">
        {/* ヘッダー */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-emerald-700 dark:text-emerald-400 mb-2">
            ずんだもん技術記事要約
          </h1>
          <p className="text-emerald-600 dark:text-emerald-400 text-sm">
            技術記事のURLを入れると、ずんだもんが要約して読み上げるのだ！
          </p>
        </div>

        {/* URL入力フォーム */}
        <form onSubmit={handleSubmit} className="mb-6">
          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/article"
              required
              disabled={isLoading}
              aria-label="記事のURL"
              className="flex-1 px-4 py-3 rounded-xl border-2 border-emerald-200 dark:border-emerald-700 focus:border-emerald-400 dark:focus:border-emerald-500 focus:outline-none bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50 transition-colors"
            />
            <button
              type="submit"
              disabled={isLoading || !url}
              className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 disabled:bg-emerald-300 dark:disabled:bg-emerald-800 text-white font-semibold rounded-xl transition-colors whitespace-nowrap"
            >
              {isLoading ? "処理中..." : "要約するのだ"}
            </button>
            {isLoading && (
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-3 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 active:bg-gray-100 dark:active:bg-gray-500 border-2 border-gray-300 dark:border-gray-500 text-gray-600 dark:text-gray-300 font-semibold rounded-xl transition-colors whitespace-nowrap"
              >
                キャンセル
              </button>
            )}
          </div>
        </form>

        {/* 処理ステータス */}
        {isLoading && (
          <div role="status" aria-live="polite" className="mb-6">
            <ol className="flex items-center justify-center gap-1">
              {(
                [
                  { key: "fetching", label: "記事取得" },
                  { key: "summarizing", label: "要約生成" },
                  { key: "speaking", label: "音声合成" },
                ] as const
              ).map(({ key, label }, i) => {
                const STEP_ORDER = ["fetching", "summarizing", "speaking"] as const;
                const currentIndex = STEP_ORDER.indexOf(step as (typeof STEP_ORDER)[number]);
                const isDone = currentIndex > i;
                const isActive = currentIndex === i;
                return (
                  <li key={key} className="flex items-center gap-1">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                        isDone
                          ? "bg-emerald-500 text-white"
                          : isActive
                          ? "bg-emerald-400 text-white animate-pulse"
                          : "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500"
                      }`}
                    >
                      {isDone ? "✓" : i + 1}
                    </div>
                    <span
                      className={`text-sm transition-colors ${
                        isActive
                          ? "text-emerald-600 dark:text-emerald-400 font-medium"
                          : isDone
                          ? "text-emerald-500"
                          : "text-gray-400 dark:text-gray-500"
                      }`}
                    >
                      {label}
                    </span>
                    {i < 2 && (
                      <div
                        className={`w-6 h-0.5 mx-1 transition-colors ${
                          isDone ? "bg-emerald-400" : "bg-gray-200 dark:bg-gray-700"
                        }`}
                      />
                    )}
                  </li>
                );
              })}
            </ol>
            <p className="text-center text-emerald-600 dark:text-emerald-400 mt-2 text-sm font-medium">
              {STEP_LABELS[step]}
            </p>
          </div>
        )}

        {/* エラー表示 */}
        {step === "error" && (
          <div
            ref={errorRef}
            role="alert"
            tabIndex={-1}
            className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6 text-red-700 dark:text-red-300 text-sm outline-none"
          >
            <p>{error}</p>
            {url && (
              <button
                type="button"
                onClick={handleRerun}
                className="mt-2 text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-200 underline transition-colors"
              >
                再試行するのだ
              </button>
            )}
          </div>
        )}

        {/* 要約テキスト */}
        {summary && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border-2 border-emerald-200 dark:border-emerald-700 p-6 mb-4 shadow-sm">
            {title && (
              <h2 className="font-bold text-gray-700 dark:text-gray-200 text-sm mb-3 pb-3 border-b border-emerald-100 dark:border-emerald-800">
                {title}
              </h2>
            )}
            <p className="text-gray-800 dark:text-gray-100 leading-relaxed whitespace-pre-wrap">
              {summary}
            </p>
            <div className="mt-4 pt-3 border-t border-emerald-100 dark:border-emerald-800 flex items-center justify-between gap-3">
              <span className="text-xs text-gray-400 dark:text-gray-500">{summary.length} 文字</span>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(summary);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-200 transition-colors"
                >
                  {copied ? "コピー済み！" : "コピー"}
                </button>
                <a
                  href={downloadHref}
                  download="summary.txt"
                  className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-200 underline transition-colors"
                >
                  テキストをダウンロード
                </a>
                <button
                  type="button"
                  onClick={handleRerun}
                  className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  再生成
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 音声プレーヤー */}
        {audioUrl && (
          <div className="bg-emerald-50 dark:bg-gray-800 rounded-2xl border-2 border-emerald-200 dark:border-emerald-700 p-4 mb-6">
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-2 font-medium">
              ずんだもんの音声
            </p>
            <audio controls autoPlay src={audioUrl} className="w-full">
              {captionUrl && (
                <track kind="captions" src={captionUrl} srcLang="ja" label="日本語" default />
              )}
            </audio>
          </div>
        )}

        {/* クレジット（ライセンス表記必須） */}
        <footer className="text-center text-xs text-gray-400 mt-10 space-y-1">
          <p>
            音声合成:{" "}
            <a
              href="https://voicevox.hiroshiba.jp/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              VOICEVOX
            </a>
          </p>
          <p>キャラクター: ずんだもん &copy; VOICEVOX / ずんだもん</p>
        </footer>
      </div>
    </main>
  );
}
