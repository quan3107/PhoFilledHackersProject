import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/.next/**"],
  },
  ...tseslint.configs.recommended,
  {
    files: ["packages/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
  }
);
