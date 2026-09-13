import type { NextRequest } from "next/server";
import { z, type ZodType } from "zod";

export type ApiErrorCode =
  | "bad_request"
  | "validation_failed"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "payload_too_large"
  | "upstream_failed"
  | "internal_error";

export interface ApiIssue {
  path: string;
  message: string;
}

/** Shape of every error response body from /api/*. */
export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string; issues?: ApiIssue[] };
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly issues?: ApiIssue[],
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new ApiError(404, "not_found", `${what} not found`);
export const unauthorized = (message = "Authentication required") => new ApiError(401, "unauthorized", message);
export const conflict = (message: string) => new ApiError(409, "conflict", message);

export function errorResponse(err: ApiError): Response {
  const body: ApiErrorBody = { error: { code: err.code, message: err.message } };
  if (err.issues?.length) body.error.issues = err.issues;
  return Response.json(body, { status: err.status });
}

function zodIssues(error: z.ZodError): ApiIssue[] {
  return error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
}

/** Wraps a route handler so thrown ApiErrors become typed JSON errors and anything else a 500. */
export function route<Ctx>(handler: (req: NextRequest, ctx: Ctx) => Promise<Response>) {
  return async (req: NextRequest, ctx: Ctx): Promise<Response> => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof ApiError) return errorResponse(err);
      console.error(`[api] ${req.method} ${req.nextUrl.pathname}`, err);
      return errorResponse(new ApiError(500, "internal_error", "Internal server error"));
    }
  };
}

const DEFAULT_MAX_BODY_BYTES = 256 * 1024;

/** Reads a JSON body and validates it. Throws ApiError on oversize, malformed JSON, or schema failure. */
export async function parseJson<S extends ZodType>(
  req: Request,
  schema: S,
  maxBytes = DEFAULT_MAX_BODY_BYTES,
): Promise<z.infer<S>> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > maxBytes) throw new ApiError(413, "payload_too_large", `Body exceeds ${maxBytes} bytes`);
  const text = await req.text();
  if (Buffer.byteLength(text) > maxBytes) {
    throw new ApiError(413, "payload_too_large", `Body exceeds ${maxBytes} bytes`);
  }
  let raw: unknown;
  try {
    raw = text.length ? JSON.parse(text) : {};
  } catch {
    throw new ApiError(400, "bad_request", "Body must be valid JSON");
  }
  return validate(schema, raw);
}

export function validate<S extends ZodType>(schema: S, value: unknown): z.infer<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new ApiError(400, "validation_failed", "Request validation failed", zodIssues(parsed.error));
  }
  return parsed.data;
}
