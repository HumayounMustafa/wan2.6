import { NextRequest, NextResponse } from "next/server";

const ENDPOINT = "https://api.runpod.ai/v2/minimax-hailuo-02-std";
const API_KEY = process.env.RUNPOD_API;

export const maxDuration = 600;

type VideoResult =
  | { kind: "url"; url: string }
  | { kind: "base64"; data: string }
  | null;

function parseOutput(output: unknown): VideoResult {
  if (!output) return null;

  const checkString = (s: string): VideoResult => {
    if (s.startsWith("http://") || s.startsWith("https://")) {
      return { kind: "url", url: s };
    }
    // Assume base64 otherwise
    return { kind: "base64", data: s };
  };

  if (typeof output === "string") return checkString(output);

  if (typeof output === "object" && output !== null) {
    const obj = output as Record<string, unknown>;
    for (const key of ["video_url", "url", "video", "video_data", "data", "result"]) {
      if (typeof obj[key] === "string") return checkString(obj[key] as string);
    }
  }

  return null;
}

function buildVideoResponse(result: VideoResult) {
  if (!result) return null;

  if (result.kind === "url") {
    return NextResponse.json({ videoUrl: result.url });
  }

  // base64 → binary
  try {
    const buf = Buffer.from(result.data, "base64");
    return new NextResponse(buf, {
      headers: { "Content-Type": "video/mp4", "Content-Length": String(buf.byteLength) },
    });
  } catch {
    return null;
  }
}

async function waitForJob(jobId: string): Promise<NextResponse> {
  const headers = { Authorization: `Bearer ${API_KEY}` };
  const deadline = Date.now() + 9 * 60 * 1000;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 5000));

    const res = await fetch(`${ENDPOINT}/status/${jobId}`, { headers });
    if (!res.ok) continue;

    const result = await res.json();

    if (result.status === "COMPLETED") {
      const video = parseOutput(result.output);
      const response = buildVideoResponse(video);
      if (response) return response;
      return NextResponse.json(
        { error: "No video data in response", raw: result.output },
        { status: 500 }
      );
    }

    if (["FAILED", "CANCELLED", "TIMED_OUT"].includes(result.status)) {
      return NextResponse.json({ error: `Job ${result.status}` }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Timed out waiting for video" }, { status: 504 });
}

export async function POST(req: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json({ error: "RUNPOD_API not configured" }, { status: 500 });
  }

  const { prompt, duration, enablePromptExpansion, image } = await req.json();
  if (!prompt?.trim()) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${API_KEY}`,
  };

  const input: Record<string, unknown> = {
    prompt,
    duration: duration ?? 6,
    enable_prompt_expansion: enablePromptExpansion ?? true,
  };
  if (image) input.image = image;

  const syncRes = await fetch(`${ENDPOINT}/runsync`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ input }),
  });

  if (!syncRes.ok) {
    const text = await syncRes.text();
    return NextResponse.json({ error: `RunPod error: ${text}` }, { status: syncRes.status });
  }

  const syncResult = await syncRes.json();

  if (syncResult.status === "COMPLETED") {
    const video = parseOutput(syncResult.output);
    const response = buildVideoResponse(video);
    if (response) return response;
    return NextResponse.json(
      { error: "No video data in response", raw: syncResult.output },
      { status: 500 }
    );
  }

  // runsync timed out on RunPod's side — poll status
  if (syncResult.id) {
    return waitForJob(syncResult.id);
  }

  return NextResponse.json(
    { error: `Unexpected response`, raw: syncResult },
    { status: 500 }
  );
}
