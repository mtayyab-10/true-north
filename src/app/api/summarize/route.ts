/**
 * POST /api/summarize
 * Takes resolved/open findings and asks Gemma 4 to write a
 * short plain-language summary in the requested language (en or ur).
 *
 * The Gemini API key NEVER leaves this server-side route.
 */
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { SummarizeRequestSchema } from "@/lib/types";

const MODEL_ID = "gemma-4-26b-a4b-it";

export async function POST(req: NextRequest) {
  const apiKey = process.env.gemini_api_key;
  if (!apiKey) {
    return NextResponse.json({ error: "gemini_api_key not configured." }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = SummarizeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { findings, language } = parsed.data;

  const findingsList = findings
    .map(
      (f) =>
        `- Field: ${f.field} | Typed: "${f.typed_value}" | Document says: "${f.document_value}" | Severity: ${f.severity} | Status: ${f.status}`
    )
    .join("\n");

  const prompt = `You are a data quality verification assistant.
Write your response in clear, concise English.

The following discrepancies were found between typed entries and what was read from the document:

${findingsList || "No discrepancies found — all entries matched the document."}

Write a short summary (3–5 sentences) that:
1. States how many discrepancies were found and their severity
2. Highlights the most important issue (if any)
3. Gives one practical suggestion to avoid similar errors in future

Keep the language simple and respectful. Do not use technical jargon.`;

  const ai = new GoogleGenAI({ apiKey });

  let text: string;
  try {
    const response = await ai.models.generateContent({
      model: MODEL_ID,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
    text = response.text ?? "No summary available.";
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[summarize] Gemma API error:", msg);
    return NextResponse.json({ error: "Gemma API call failed: " + msg }, { status: 502 });
  }

  return NextResponse.json({ summary: text.trim() });
}
