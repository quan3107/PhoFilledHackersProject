import type { PublicApiErrorCode } from "./api-errors";

export interface ApiLogContext {
  requestId?: string | null;
  operationId?: string | null;
  userId?: string | null;
  recommendationRunId?: string | null;
  publicErrorCode?: PublicApiErrorCode | "validation_failed";
  internalError?: unknown;
}

export function getRequestId(request: Request) {
  return (
    request.headers.get("x-request-id") ??
    request.headers.get("x-vercel-id") ??
    crypto.randomUUID()
  );
}

export function logApiError(context: ApiLogContext, error: unknown) {
  console.error(
    JSON.stringify({
      event: "api.error",
      requestId: context.requestId ?? null,
      operationId: context.operationId ?? context.requestId ?? null,
      userId: context.userId ?? null,
      recommendationRunId: context.recommendationRunId ?? null,
      publicErrorCode: context.publicErrorCode ?? "internal_error",
      internalError: serializeError(error),
    })
  );
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    name: typeof error,
    message: String(error),
  };
}
