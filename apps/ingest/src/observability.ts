export interface IngestLogEvent {
  event: "ingest.run_failed";
  operationId: string;
  ingestRunId: string;
  publicErrorCode: string;
  stage: string | null;
  schoolSlug: string;
  triggeredBy: string;
  internalError: {
    name: string;
    message: string;
    stack?: string;
  };
}

export interface IngestLogger {
  error(event: IngestLogEvent): void;
}

export const consoleIngestLogger: IngestLogger = {
  error(event) {
    console.error(JSON.stringify(event));
  },
};

export function serializeIngestError(error: unknown) {
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
