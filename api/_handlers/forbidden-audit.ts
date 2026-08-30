/**
 * GET /api/forbidden-audit, Vercel adapter. The body is in
 * src/evidence/endpoints.ts so that this host and Netlify serve byte-identical
 * answers.
 */
import { forbiddenAuditResponse } from "../../src/evidence/endpoints.ts";

export async function GET(request: Request): Promise<Response> {
  return forbiddenAuditResponse(request);
}
