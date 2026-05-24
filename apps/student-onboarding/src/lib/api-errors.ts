import { NextResponse } from "next/server";

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

export function jsonApiError(error: unknown) {
  if (error instanceof PublicApiError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status }
    );
  }

  console.error("[api] unhandled error", error);
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
