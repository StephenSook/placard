/**
 * GET /api/measure, Vercel adapter. The body is in src/evidence/endpoints.ts
 * so that this host and Netlify serve byte-identical answers.
 */
import { measureResponse } from "../../src/evidence/endpoints.ts";

export async function GET(): Promise<Response> {
  return measureResponse();
}
