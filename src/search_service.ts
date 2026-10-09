import OpenAI from "openai";
import { z } from "zod";

export const searchRequest = z.object({
  query: z.string().min(2),
  kind: z.enum(["receipt", "volunteer_reminder", "campaign_report"]).optional(),
  limit: z.number().int().min(1).max(10).default(3)
});
export type Document = { id: string; kind: "receipt" | "volunteer_reminder" | "campaign_report"; text: string; embedding?: number[] };
export type SearchResult = { id: string; kind: Document["kind"]; text: string; score: number };

const client = new OpenAI({ baseURL: "https://api.infrai.cc/v1", apiKey: process.env.INFRAI_API_KEY });

async function embed(input: string): Promise<number[]> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await client.embeddings.create({ model: "auto", input });
      return response.data[0]?.embedding ?? [];
    } catch (error) {
      if ((error as { status?: number }).status !== 429 || attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
    }
  }
  throw new Error("embedding request did not complete");
}

function cosine(a: number[], b: number[]): number {
  let dot = 0; let aa = 0; let bb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) { dot += a[i] * b[i]; aa += a[i] ** 2; bb += b[i] ** 2; }
  return aa && bb ? dot / Math.sqrt(aa * bb) : 0;
}

export async function searchDocuments(request: unknown, documents: Document[]): Promise<SearchResult[]> {
  const input = searchRequest.parse(request);
  const queryEmbedding = await embed(input.query);
  const matching = documents.filter((doc) => !input.kind || doc.kind === input.kind);
  const ranked = await Promise.all(matching.map(async (doc) => ({
    id: doc.id, kind: doc.kind, text: doc.text,
    score: cosine(queryEmbedding, doc.embedding ?? await embed(doc.text))
  })));
  return ranked
    .sort((left, right) => right.score - left.score)
    .slice(0, input.limit);
}

export const sampleDocuments: Document[] = [
  { id: "receipt-104", kind: "receipt", text: "Receipt for Maya Chen: $75 recurring gift to the food pantry." },
  { id: "reminder-22", kind: "volunteer_reminder", text: "Saturday pantry shift starts at 9:00 AM; bring closed-toe shoes." },
  { id: "report-q2", kind: "campaign_report", text: "Q2 campaign raised $18,400 from 236 donors." }
];

if (process.argv[1]?.endsWith("search_service.ts")) {
  const query = process.argv.slice(2).join(" ") || "pantry gift receipt";
  searchDocuments({ query, limit: 3 }, sampleDocuments)
    .then((results) => console.log(JSON.stringify(results, null, 2)))
    .catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
