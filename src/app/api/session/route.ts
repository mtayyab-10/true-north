import { NextRequest, NextResponse } from "next/server";
import { getSession, saveSession, createSessionId, ReviewSession } from "@/lib/review-store";

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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "Session ID required" },
      { status: 400, headers: corsHeaders() }
    );
  }

  const session = getSession(id);
  if (!session) {
    return NextResponse.json(
      { error: "Session not found" },
      { status: 404, headers: corsHeaders() }
    );
  }

  return NextResponse.json({ session }, { status: 200, headers: corsHeaders() });
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400, headers: corsHeaders() }
    );
  }

  const id = body.id || createSessionId();
  const session: ReviewSession = {
    id,
    source: body.source || "extension",
    createdAt: body.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    entries: body.entries || [],
    documentExtraction: body.documentExtraction || null,
    context: body.context || {
      business_type: "General Commerce",
      currency: "PKR",
      reporting_period: "Current Period",
      allowed_variance_pct: 0,
    },
    findings: body.findings || [],
    gateState: body.gateState || "not_checked",
  };

  saveSession(session);
  return NextResponse.json({ session }, { status: 200, headers: corsHeaders() });
}
