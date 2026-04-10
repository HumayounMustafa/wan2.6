import { NextRequest, NextResponse } from "next/server";

const ENDPOINT = "https://api.runpod.ai/v2/wan-2-6-t2i";
const API_KEY = process.env.RUNPOD_API;

export async function POST(req: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json({ error: "RUNPOD_API not configured" }, { status: 500 });
  }

  const { prompt } = await req.json();
  if (!prompt?.trim()) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${API_KEY}`,
  };

  // Submit job
  const submitRes = await fetch(`${ENDPOINT}/run`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      input: {
        prompt,
        size: "1024*1024",
        seed: -1,
        enable_safety_checker: true,
        width: null,
        height: null,
      },
    }),
  });

  if (!submitRes.ok) {
    const text = await submitRes.text();
    return NextResponse.json({ error: `RunPod error: ${text}` }, { status: submitRes.status });
  }

  const { id: jobId } = await submitRes.json();

  // Poll until complete (max 10 min)
  const deadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 4000));

    const pollRes = await fetch(`${ENDPOINT}/status/${jobId}`, { headers });
    if (!pollRes.ok) continue;

    const result = await pollRes.json();
    const status: string = result.status;

    if (status === "COMPLETED") {
      const imageUrl: string = result.output?.result;
      return NextResponse.json({ imageUrl });
    }

    if (["FAILED", "CANCELLED", "TIMED_OUT"].includes(status)) {
      return NextResponse.json({ error: `Job ${status}` }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Timed out waiting for image" }, { status: 504 });
}
