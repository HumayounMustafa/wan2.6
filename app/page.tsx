"use client";

import { useState, useRef } from "react";

const EXAMPLE_PROMPT =
  "A modern tea shop interior, warm afternoon light, minimalist wood design, cinematic photography, medium shot, shallow depth of field, 35mm look, clean lines, natural shadows, soft highlights, cozy seating, neatly arranged tea bar, high detail";

type Status = "idle" | "loading" | "done" | "error";

export default function Home() {
  const [prompt, setPrompt] = useState(EXAMPLE_PROMPT);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = () => {
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const generate = async () => {
    if (!prompt.trim() || status === "loading") return;
    setStatus("loading");
    setError(null);
    setImageUrl(null);
    startTimer();

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Unknown error");

      setImageUrl(data.imageUrl);
      setStatus("done");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setStatus("error");
    } finally {
      stopTimer();
    }
  };

  const reset = () => {
    stopTimer();
    setStatus("idle");
    setError(null);
    setImageUrl(null);
    setElapsed(0);
    setPrompt(EXAMPLE_PROMPT);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate();
  };

  return (
    <main className="min-h-screen flex flex-col md:h-screen md:overflow-hidden">
      {/* Header */}
      <header className="border-b border-white/[0.06] px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-white" stroke="currentColor" strokeWidth={2}>
              <path d="M15 3H21V9" /><path d="M9 21H3V15" />
              <path d="M21 3L14 10" /><path d="M3 21L10 14" />
            </svg>
          </div>
          <span className="text-sm font-semibold tracking-tight text-white/90">Text-to-Image</span>
        </div>
      </header>

      {/* Body — stacks vertically on mobile, side-by-side on desktop */}
      <div className="flex flex-col md:flex-row md:flex-1 md:overflow-hidden">
        {/* Prompt panel */}
        <div className="w-full md:w-[420px] md:shrink-0 flex flex-col border-b md:border-b-0 md:border-r border-white/[0.06] p-6 gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-white/40 uppercase tracking-widest">Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKey}
              rows={6}
              placeholder="Describe the image you want to generate…"
              className="resize-none rounded-xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-sm text-white/90 placeholder-white/20 focus:outline-none focus:border-violet-500/60 focus:bg-white/[0.06] transition-all leading-relaxed"
            />
            <p className="text-xs text-white/20 text-right hidden md:block">⌘ Enter to generate</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={reset}
              disabled={status === "loading"}
              className="flex-1 px-4 py-2.5 rounded-xl border border-white/[0.08] text-sm text-white/50 hover:text-white/80 hover:border-white/20 transition-all disabled:opacity-30"
            >
              Reset
            </button>
            <button
              onClick={generate}
              disabled={status === "loading" || !prompt.trim()}
              className="flex-[2] px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-violet-900/30"
            >
              {status === "loading" ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner />
                  Generating{elapsed > 0 ? ` · ${elapsed}s` : "…"}
                </span>
              ) : (
                "Generate"
              )}
            </button>
          </div>

          {/* Error */}
          {status === "error" && error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-xs text-red-400 leading-relaxed">
              {error}
            </div>
          )}
        </div>

        {/* Preview panel */}
        <div className="flex-1 flex items-center justify-center p-6 md:p-8 bg-[#07070c] min-h-[320px]">
          {status === "idle" && !imageUrl && <EmptyState />}

          {status === "loading" && (
            <div className="flex flex-col items-center gap-4 text-white/30">
              <PulsingGrid />
              <p className="text-sm">Generating your image…</p>
              <p className="text-xs text-white/20">This usually takes 15–60 seconds</p>
            </div>
          )}

          {status === "done" && imageUrl && (
            <div className="flex flex-col items-center gap-4 max-w-2xl w-full">
              <img
                src={imageUrl}
                alt="Generated"
                className="w-full rounded-2xl shadow-2xl shadow-black/60 border border-white/[0.06]"
              />
              <a
                href={imageUrl}
                download="generated.png"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-white/40 hover:text-white/70 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
                  <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 11l5 5 5-5M12 4v12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Download image
              </a>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center gap-3 text-white/30">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8 text-red-400/60">
                  <circle cx={12} cy={12} r={10} /><path d="M12 8v4M12 16h.01" strokeLinecap="round" />
                </svg>
              </div>
              <p className="text-sm">Generation failed</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 text-center max-w-xs">
      <div className="w-20 h-20 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} className="w-10 h-10 text-white/20">
          <rect x={3} y={3} width={18} height={18} rx={3} />
          <circle cx={8.5} cy={8.5} r={1.5} />
          <path d="M21 15l-5-5L5 21" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div>
        <p className="text-sm text-white/30 font-medium">No image yet</p>
        <p className="text-xs text-white/20 mt-1 leading-relaxed">Enter a prompt and click Generate to create an image</p>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle cx={12} cy={12} r={10} stroke="currentColor" strokeWidth={2} strokeOpacity={0.25} />
      <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

function PulsingGrid() {
  return (
    <div className="grid grid-cols-3 gap-2">
      {Array.from({ length: 9 }).map((_, i) => (
        <div
          key={i}
          className="w-5 h-5 rounded bg-violet-500/20 animate-pulse"
          style={{ animationDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  );
}
