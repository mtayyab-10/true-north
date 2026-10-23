import type { TypedEntry, Finding, BusinessContext, ExtractionResult, QualityGateState } from "./types";

export interface ReviewSession {
  id: string;
  source: "web" | "extension";
  createdAt: string;
  updatedAt: string;
  entries: TypedEntry[];
  documentExtraction: ExtractionResult | null;
  context: BusinessContext;
  findings: Finding[];
  gateState: QualityGateState;
  releasedRecord?: any;
}

// In-memory global store with 24-hour retention for active hackathon demo sessions
const sessions = new Map<string, ReviewSession>();

export function saveSession(session: ReviewSession): void {
  session.updatedAt = new Date().toISOString();
  sessions.set(session.id, session);
}

export function getSession(id: string): ReviewSession | undefined {
  return sessions.get(id);
}

export function createSessionId(): string {
  return "TSD-" + Math.random().toString(36).substring(2, 8).toUpperCase();
}
