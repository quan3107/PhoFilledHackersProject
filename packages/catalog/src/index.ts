// packages/catalog/src/index.ts
// Public catalog surface for normalized records, publishability, and reads.
// Keeps catalog rules centralized in one package-owned entrypoint.

export * from "./types.js";
export * from "./source-selection.js";
export * from "./normalize.js";
export * from "./catalog-persistence.js";
export * from "./publishability.js";
export * from "./recommendation-catalog-read-path.js";
export * from "./recommendation-engine-config.js";
export * from "./recommendation-engine.js";
export * from "./recommendation-explanation-prompt.js";
export * from "./recommendation-explanation-read-path.js";
export * from "./recommendation-explanation-service.js";
