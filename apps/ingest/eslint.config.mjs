import { defineConfig } from "eslint/config";
import { fileURLToPath } from "url";
import { dirname } from "path";
import tseslint from "typescript-eslint";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig(
  {
    ignores: ["dist/**", "node_modules/**", "eslint.config.mjs", "tests/**"],
  },
  ...tseslint.configs.recommended,
  {
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      complexity: ["error", { "max": 20 }],
    },
  }
);
