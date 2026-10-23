import { NextRequest, NextResponse } from "next/server";
import { runUnifiedVerification } from "@/lib/verification-engine";
import { VerifyRequestSchema } from "@/lib/types";
import { saveSession, getSession, createSessionId, ReviewSession } from "@/lib/review-store";

// CORS headers to enable seamless communication with the browser extension
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: corsHeaders() }
    );
  }

  const parsed = VerifyRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation error: " + parsed.error.message },
      { status: 400, headers: corsHeaders() }
    );
  }

  const { entries, documentExtraction, context } = parsed.data;
  const apiKey = process.env.gemini_api_key;
  const sessionId = body.sessionId || createSessionId();
  const source = body.source || "web";

  try {
    const result = await runUnifiedVerification({
      entries,
      documentExtraction,
      context,
      apiKey,
      skipGemma: !apiKey,
    });

    // Store in shared session
    const session: ReviewSession = {
      id: sessionId,
      source: source as "web" | "extension",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      entries,
      documentExtraction: documentExtraction ?? null,
      context: context ?? {
        business_type: "General Commerce",
        currency: "PKR",
        reporting_period: "Current Period",
        allowed_variance_pct: 0,
      },
      findings: result.findings,
      gateState: result.gateState,
    };
    saveSession(session);

    return NextResponse.json(
      {
        sessionId,
        gateState: result.gateState,
        findings: result.findings,
        summary: result.summary,
        stats: result.stats,
      },
      { status: 200, headers: corsHeaders() }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[api/verify] Error:", msg);
    return NextResponse.json(
      { error: "Verification process failed: " + msg },
      { status: 500, headers: corsHeaders() }
    );
  }
}
