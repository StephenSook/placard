/**
 * GET /api/forbidden-audit, Netlify adapter. The body is in
 * src/evidence/endpoints.ts so that this host and Vercel serve byte-identical
 * answers.
 */
import { forbiddenAuditResponse } from "../../src/evidence/endpoints.ts";

export default async (req: Request): Promise<Response> => forbiddenAuditResponse(req);

export const config = { path: "/api/forbidden-audit" };
