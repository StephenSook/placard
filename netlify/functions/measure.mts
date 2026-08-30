/**
 * GET /api/measure, Netlify adapter. The body is in src/evidence/endpoints.ts
 * so that this host and Vercel serve byte-identical answers.
 */
import { measureResponse } from "../../src/evidence/endpoints.ts";

export default async (): Promise<Response> => measureResponse();

export const config = { path: "/api/measure" };
