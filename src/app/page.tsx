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
  } = useSummarizer(url);

  return (
    <main className="min-h-screen bg-gradient-to-b from-green-50 to-emerald-50 px-4 py-12">
      <div className="max-w-2xl mx-auto">
        {/* ヘッダー */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-emerald-700 mb-2">
            ずんだもん技術記事要約
          </h1>
          <p className="text-emerald-600 text-sm">
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
              className="flex-1 px-4 py-3 rounded-xl border-2 border-emerald-200 focus:border-emerald-400 focus:outline-none bg-white text-gray-800 placeholder-gray-400 disabled:opacity-50 transition-colors"
            />
            <button
              type="submit"
              disabled={isLoading || !url}
              className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 disabled:bg-emerald-300 text-white font-semibold rounded-xl transition-colors whitespace-nowrap"
            >
              {isLoading ? "処理中..." : "要約するのだ"}
            </button>
          </div>
        </form>

        {/* 処理ステータス */}
        {isLoading && (
          <div
            role="status"
            aria-live="polite"
            className="text-center text-emerald-600 mb-6 animate-pulse font-medium"
          >
            {STEP_LABELS[step]}
          </div>
        )}

        {/* エラー表示 */}
        {step === "error" && (
          <div
            ref={errorRef}
            role="alert"
            tabIndex={-1}
            className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-700 text-sm outline-none"
          >
            {error}
          </div>
        )}

        {/* 要約テキスト */}
        {summary && (
          <div className="bg-white rounded-2xl border-2 border-emerald-200 p-6 mb-4 shadow-sm">
            {title && (
              <h2 className="font-bold text-gray-700 text-sm mb-3 pb-3 border-b border-emerald-100">
                {title}
              </h2>
            )}
            <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
              {summary}
            </p>
            <div className="mt-4 pt-3 border-t border-emerald-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(summary);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="text-xs text-emerald-600 hover:text-emerald-800 transition-colors"
              >
                {copied ? "コピー済み！" : "コピー"}
              </button>
              <a
                href={downloadHref}
                download="summary.txt"
                className="text-xs text-emerald-600 hover:text-emerald-800 underline transition-colors"
              >
                テキストをダウンロード
              </a>
            </div>
          </div>
        )}

        {/* 音声プレーヤー */}
        {audioUrl && (
          <div className="bg-emerald-50 rounded-2xl border-2 border-emerald-200 p-4 mb-6">
            <p className="text-xs text-emerald-600 mb-2 font-medium">
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
              className="underline hover:text-gray-600 transition-colors"
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
