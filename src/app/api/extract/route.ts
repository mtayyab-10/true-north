/**
 * POST /api/extract
 * Receives a base64 image, sends it to Gemma 4 via Gemini API,
 * and returns structured extraction (line items, totals, etc.).
 *
 * The Gemini API key NEVER leaves this server-side route.
 */
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { ExtractionResultSchema, ExtractRequestSchema } from "@/lib/types";

const MODEL_ID = "gemma-4-26b-a4b-it";

const SYSTEM_PROMPT = `You are a document data extractor for business records.
You receive an image of a handwritten or printed ledger, bill, or invoice.
Your job: extract ONLY what is clearly visible in the image. Never invent data.
Return a single valid JSON object — no markdown, no code fences, no commentary — with this exact shape:

{
  "vendor_name": string | null,
  "invoice_number": string | null,
  "date": string | null,
  "line_items": [
    { "description": string, "quantity": number | null, "unit_price": number | null, "line_total": number | null }
  ],
  "subtotal": number | null,
  "tax": number | null,
  "total_amount": number | null,
  "currency": string | null,
  "raw_text_snippet": string | null,
  "language_detected": "en" | "ur" | "mixed" | null
}

Rules:
- All numeric fields must be plain numbers (no currency symbols, no commas).
- If a field is not visible or legible, set it to null.
- "raw_text_snippet" should be a short representative quote from the document (max 80 chars).
- "language_detected" reflects the primary label language you see.
`;

export async function POST(req: NextRequest) {
  // ── Validate API key presence (server-side only) ───────────────────────────
  const apiKey = process.env.gemini_api_key || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "gemini_api_key is not configured on the server." },
      { status: 500 }
    );
  }

  // ── Parse & validate request body ─────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = ExtractRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Bad request: " + parsed.error.message }, { status: 400 });
  }
  const { imageBase64, mimeType } = parsed.data;

  // ── Call Gemma 4 via Gemini API ───────────────────────────────────────────
  const ai = new GoogleGenAI({ apiKey });

  let rawText: string;
  try {
    const response = await ai.models.generateContent({
      model: MODEL_ID,
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: mimeType as "image/jpeg" | "image/png" | "image/webp",
                data: imageBase64,
              },
            },
            {
              text: SYSTEM_PROMPT + "\n\nExtract all data from this document image now:",
            },
          ],
        },
      ],
    });
    rawText = response.text ?? "";
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[extract] Gemma API error:", msg);
    return NextResponse.json(
      { error: "Gemma API call failed: " + msg },
      { status: 502 }
    );
  }

  // ── Strip code fences and parse JSON ─────────────────────────────────────
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let jsonData: unknown;
  try {
    jsonData = JSON.parse(cleaned);
  } catch {
    // Retry: try to extract a JSON object from anywhere in the string
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) {
      return NextResponse.json(
        { error: "Model did not return valid JSON.", raw: cleaned.slice(0, 500) },
        { status: 422 }
      );
    }
    try {
      jsonData = JSON.parse(match[0]);
    } catch {
      return NextResponse.json(
        { error: "Could not parse JSON from model response.", raw: cleaned.slice(0, 500) },
        { status: 422 }
      );
    }
  }

  // ── Validate with Zod ─────────────────────────────────────────────────────
  const validated = ExtractionResultSchema.safeParse(jsonData);
  if (!validated.success) {
    // Partial result — return what we got, flagging the issue
    return NextResponse.json({ data: jsonData, warning: "Schema mismatch: " + validated.error.message });
  }

  return NextResponse.json({ data: validated.data });
}
