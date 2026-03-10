"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type Step = "idle" | "fetching" | "summarizing" | "speaking" | "done" | "error";

export const STEP_LABELS: Record<Step, string> = {
  idle: "",
  fetching: "記事を取得中なのだ...",
  summarizing: "要約中なのだ... (少し時間がかかるのだ)",
  speaking: "音声を生成中なのだ...",
  done: "完成したのだ！",
  error: "",
};

export function useSummarizer(url: string) {
  const [step, setStep] = useState<Step>("idle");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [captionUrl, setCaptionUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const prevAudioUrl = useRef<string | null>(null);
  const prevCaptionUrl = useRef<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  function handleCancel() {
    abortRef.current?.abort();
  }

  useEffect(() => {
    if (step === "error") errorRef.current?.focus();
  }, [step]);

  const isLoading = step === "fetching" || step === "summarizing" || step === "speaking";
  const downloadHref = useMemo(
    () => `data:text/plain;charset=utf-8,${encodeURIComponent(summary)}`,
    [summary]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // 前のリクエストをキャンセル（連打対策）
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;

    setError("");
    setSummary("");
    setTitle("");

    // 前の音声・字幕URLを解放してメモリリークを防ぐ
    if (prevAudioUrl.current) {
      URL.revokeObjectURL(prevAudioUrl.current);
      prevAudioUrl.current = null;
    }
    if (prevCaptionUrl.current) {
      URL.revokeObjectURL(prevCaptionUrl.current);
      prevCaptionUrl.current = null;
    }
    setAudioUrl(null);
    setCaptionUrl(null);

    try {
      // Step 1: 記事取得
      setStep("fetching");
      const fetchRes = await fetch("/api/fetch-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
        signal,
      });
      const fetchData = await fetchRes.json();
      if (!fetchRes.ok) throw new Error(fetchData.error);
      setTitle(fetchData.title);

      // Step 2: 要約
      setStep("summarizing");
      const sumRes = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: fetchData.title, text: fetchData.text }),
        signal,
      });
      const sumData = await sumRes.json();
      if (!sumRes.ok) throw new Error(sumData.error);
      setSummary(sumData.summary);

      // Step 3: 音声生成
      setStep("speaking");
      const speakRes = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sumData.summary }),
        signal,
      });
      if (!speakRes.ok) {
        const speakData = await speakRes.json();
        throw new Error(speakData.error);
      }
      const audioBlob = await speakRes.blob();
      const objectUrl = URL.createObjectURL(audioBlob);
      prevAudioUrl.current = objectUrl;

      // 音声の字幕として要約テキストを WebVTT に変換
      const vtt = `WEBVTT\n\n00:00:00.000 --> 99:59:59.999\n${sumData.summary}`;
      const captionBlob = new Blob([vtt], { type: "text/vtt" });
      const captionObjectUrl = URL.createObjectURL(captionBlob);
      prevCaptionUrl.current = captionObjectUrl;

      setAudioUrl(objectUrl);
      setCaptionUrl(captionObjectUrl);
      setStep("done");
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setStep("idle");
        return;
      }
      console.error("[handleSubmit]", err);
      setError(err instanceof Error ? err.message : "予期しないエラーが発生したのだ");
      setStep("error");
    }
  }

  return {
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
  };
}
