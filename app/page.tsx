"use client";

import { useState, useRef, useEffect } from "react";

const EXAMPLE_PROMPT =
  "A golden retriever puppy tumbles through a pile of autumn leaves in a sun-dappled park, slow motion, cinematic, warm golden light, shallow depth of field";

type Status = "idle" | "loading" | "done" | "error";

export default function Home() {
  const [prompt, setPrompt] = useState(EXAMPLE_PROMPT);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(6);
  const [enableExpansion, setEnableExpansion] = useState(true);
  const [imageB64, setImageB64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const startTimer = () => {
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImagePreview(dataUrl);
      setImageB64(dataUrl.split(",")[1]);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageB64(null);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  // Revoke previous blob URL to avoid memory leaks
  useEffect(() => {
    return () => {
      if (videoUrl?.startsWith("blob:")) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  const generate = async () => {
    if (!prompt.trim() || status === "loading") return;
    setStatus("loading");
    setError(null);
    if (videoUrl?.startsWith("blob:")) URL.revokeObjectURL(videoUrl);
    setVideoUrl(null);
    startTimer();

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          duration,
          enablePromptExpansion: enableExpansion,
          image: imageB64,
        }),
      });

      const contentType = res.headers.get("content-type") ?? "";

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      let resolvedUrl: string;

      if (contentType.includes("video")) {
        // Binary video — wrap in a blob URL
        const blob = await res.blob();
        resolvedUrl = URL.createObjectURL(blob);
      } else {
        // JSON response — either { videoUrl } or { error, raw }
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        if (!data.videoUrl) throw new Error("No video URL in response");
        resolvedUrl = data.videoUrl;
      }

      setVideoUrl(resolvedUrl);
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
    if (videoUrl?.startsWith("blob:")) URL.revokeObjectURL(videoUrl);
    setVideoUrl(null);
    setElapsed(0);
    setPrompt(EXAMPLE_PROMPT);
    setDuration(6);
    setEnableExpansion(true);
    removeImage();
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate();
  };

  const elapsedFmt = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;

  return (
    <main className="min-h-screen flex flex-col md:h-screen md:overflow-hidden" style={{ background: "#07070d" }}>
      {/* Header */}
      <header className="shrink-0 border-b border-white/[0.06] px-5 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-violet-600 flex items-center justify-center shadow-lg shadow-sky-900/40">
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold tracking-tight text-white/90">Text-to-Video</span>
          <span className="text-xs text-white/25 hidden sm:block">Minimax Hailuo-02</span>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-col md:flex-row md:flex-1 md:overflow-hidden">

        {/* ── Left panel: controls ── */}
        <div className="w-full md:w-[380px] md:shrink-0 flex flex-col border-b md:border-b-0 md:border-r border-white/[0.06] p-5 gap-5 md:overflow-y-auto">

          {/* Prompt */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-semibold text-white/35 uppercase tracking-widest">Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKey}
              rows={5}
              placeholder="Describe the video you want to generate…"
              className="resize-none rounded-xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-sm text-white/85 placeholder-white/20 focus:outline-none focus:border-sky-500/50 focus:bg-white/[0.06] transition-all leading-relaxed"
            />
            <p className="text-xs text-white/20 text-right hidden md:block">⌘ Enter to generate</p>
          </div>

          {/* Reference image */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-semibold text-white/35 uppercase tracking-widest">
              Reference Image <span className="normal-case font-normal text-white/20">(optional)</span>
            </label>
            {imagePreview ? (
              <div className="relative rounded-xl overflow-hidden border border-white/[0.08] group">
                <img src={imagePreview} alt="Reference" className="w-full h-28 object-cover" />
                <button
                  onClick={removeImage}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/70 hover:bg-black/90 flex items-center justify-center transition-colors"
                  aria-label="Remove image"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3 h-3 text-white">
                    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="rounded-xl border border-dashed border-white/[0.10] hover:border-sky-500/40 hover:bg-white/[0.02] transition-all py-5 flex flex-col items-center gap-2 text-white/25 hover:text-white/45"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-xs">Click to upload image</span>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          </div>

          {/* Duration */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-semibold text-white/35 uppercase tracking-widest">Duration</label>
            <div className="flex gap-2">
              {[6, 10].map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all border ${
                    duration === d
                      ? "bg-sky-500/15 border-sky-500/40 text-sky-300"
                      : "bg-white/[0.03] border-white/[0.08] text-white/40 hover:text-white/60 hover:border-white/20"
                  }`}
                >
                  {d}s
                </button>
              ))}
            </div>
          </div>

          {/* Prompt expansion toggle */}
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm text-white/65">Prompt Expansion</p>
              <p className="text-xs text-white/28 mt-0.5">AI enhances your prompt</p>
            </div>
            <button
              onClick={() => setEnableExpansion((v) => !v)}
              aria-pressed={enableExpansion}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                enableExpansion ? "bg-sky-500" : "bg-white/10"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                  enableExpansion ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Divider */}
          <div className="h-px bg-white/[0.05]" />

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={reset}
              disabled={status === "loading"}
              className="flex-1 px-4 py-2.5 rounded-xl border border-white/[0.08] text-sm text-white/45 hover:text-white/75 hover:border-white/20 transition-all disabled:opacity-30"
            >
              Reset
            </button>
            <button
              onClick={generate}
              disabled={status === "loading" || !prompt.trim()}
              className="flex-[2] px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-violet-600 hover:from-sky-400 hover:to-violet-500 text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-sky-900/25"
            >
              {status === "loading" ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner />
                  {elapsed > 0 ? elapsedFmt : "Starting…"}
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

        {/* ── Right panel: preview ── */}
        <div className="flex-1 flex flex-col p-5 md:p-8 min-h-[320px] md:overflow-y-auto" style={{ background: "#050509" }}>

          {status === "idle" && !videoUrl && (
            <div className="m-auto">
              <EmptyState />
            </div>
          )}

          {status === "loading" && (
            <div className="m-auto flex flex-col items-center gap-5 text-white/30">
              <FilmStrip />
              <div className="flex flex-col items-center gap-1">
                <p className="text-sm text-white/50">Generating your video…</p>
                <p className="text-xs text-white/25">Usually takes 1–3 minutes</p>
              </div>
              {elapsed > 0 && (
                <div className="flex items-center gap-1.5 bg-white/[0.04] rounded-full px-3 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
                  <span className="text-xs font-mono text-white/30">{elapsedFmt}</span>
                </div>
              )}
            </div>
          )}

          {status === "done" && videoUrl && (
            <div className="m-auto flex flex-col items-center gap-4 max-w-3xl w-full py-2">
              <video
                src={videoUrl}
                controls
                autoPlay
                loop
                playsInline
                className="w-full rounded-2xl shadow-2xl shadow-black/70 border border-white/[0.06] md:max-h-[calc(100vh-14rem)]"
              />
              <button
                onClick={() => {
                  if (!videoUrl) return;
                  const a = document.createElement("a");
                  a.href = videoUrl;
                  a.download = "generated.mp4";
                  a.click();
                }}
                className="flex items-center gap-2 text-xs text-white/35 hover:text-white/65 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
                  <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 11l5 5 5-5M12 4v12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Download video
              </button>
            </div>
          )}

          {status === "error" && (
            <div className="m-auto flex flex-col items-center gap-3 text-white/30">
              <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7 text-red-400/60">
                  <circle cx={12} cy={12} r={10} />
                  <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
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
          <rect x={2} y={6} width={20} height={12} rx={2} />
          <path d="M12 10v4M10 12h4" strokeLinecap="round" />
          <circle cx={6} cy={12} r={1} />
          <circle cx={18} cy={12} r={1} />
        </svg>
      </div>
      <div>
        <p className="text-sm text-white/30 font-medium">No video yet</p>
        <p className="text-xs text-white/20 mt-1 leading-relaxed">Enter a prompt and click Generate<br className="hidden sm:block" /> to create a video</p>
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

function FilmStrip() {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col gap-1"
          style={{ animationDelay: `${i * 120}ms` }}
        >
          <div className="w-1.5 h-1.5 rounded-sm bg-white/20" />
          <div
            className="w-10 rounded bg-violet-500/20 animate-pulse"
            style={{ height: `${40 + (i % 3) * 10}px`, animationDelay: `${i * 120}ms` }}
          />
          <div className="w-1.5 h-1.5 rounded-sm bg-white/20" />
        </div>
      ))}
    </div>
  );
}
