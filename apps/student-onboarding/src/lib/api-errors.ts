import { NextResponse } from "next/server";

import { type ApiLogContext, logApiError } from "./observability";

export type PublicApiErrorCode =
  | "invalid_request"
  | "dependency_unavailable"
  | "model_output_invalid"
  | "recommendation_not_ready"
  | "internal_error";

export class PublicApiError extends Error {
  constructor(
    public readonly code: PublicApiErrorCode,
    message: string,
    public readonly status = 400
  ) {
    super(message);
  }
}

export function jsonApiError(error: unknown, context: ApiLogContext = {}) {
  if (error instanceof PublicApiError) {
    logApiError(
      { ...context, publicErrorCode: error.code },
      context.internalError ?? error
    );
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status }
    );
  }

  logApiError({ ...context, publicErrorCode: "internal_error" }, error);
  return NextResponse.json(
    {
      error: {
        code: "internal_error",
        message: "Something went wrong. Please try again.",
      },
    },
    { status: 500 }
  );
}
