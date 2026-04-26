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

  const syncRes = await fetch(`${ENDPOINT}/runsync`, {
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

  if (!syncRes.ok) {
    const text = await syncRes.text();
    return NextResponse.json({ error: `RunPod error: ${text}` }, { status: syncRes.status });
  }

  const result = await syncRes.json();

  if (["FAILED", "CANCELLED", "TIMED_OUT"].includes(result.status)) {
    return NextResponse.json({ error: `Job ${result.status}` }, { status: 500 });
  }

  const jobId: string = result.id;
  const statusRes = await fetch(`${ENDPOINT}/status/${jobId}`, { headers });

  if (!statusRes.ok) {
    return NextResponse.json({ error: "Failed to fetch job status" }, { status: statusRes.status });
  }

  const statusResult = await statusRes.json();
  const imageUrl: string = statusResult.output?.result ?? result.output?.result;

  if (!imageUrl) {
    return NextResponse.json({ error: "No image in response" }, { status: 500 });
  }

  return NextResponse.json({ imageUrl });
}
