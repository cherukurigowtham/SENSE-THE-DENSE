// eslint.config.mjs
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // Keep Next defaults (Core Web Vitals + TS)
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  // Global ignores
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      ".vercel/**",
      "coverage/**",
      "dist/**",
    ],
  },

  // Project-wide rules (applies to JS/TS/React files)
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooks,
    },
    rules: {
      // So builds don’t fail on these:
      "@typescript-eslint/no-explicit-any": "warn",
      // Allow @ts-ignore (prefer @ts-expect-error but don't block builds)
      "@typescript-eslint/ban-ts-comment": [
        "warn",
        {
          "ts-expect-error": "allow-with-description",
          "ts-ignore": "allow-with-description",
          "ts-nocheck": true,
          "ts-check": true,
        },
      ],
      // Stop failing on “complex expression in deps array”
      "react-hooks/exhaustive-deps": "warn",

      // Common QoL tweaks
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-console": "off",
      "no-debugger": "warn",
    },
    languageOptions: {
      parserOptions: {
        // Helps TS rules understand your project
        project: "./tsconfig.json",
        tsconfigRootDir: __dirname,
      },
    },
    settings: {
      react: { version: "detect" },
    },
  },

  // Loosen rules for config and build scripts if you have them
  {
    files: ["**/*.{config,cfg}.{js,cjs,mjs,ts}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-var-requires": "off",
    },
  },

  // Example: lighten up tests (if you add them later)
  {
    files: ["**/*.test.{ts,tsx,js,jsx}", "**/__tests__/**/*.{ts,tsx,js,jsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/exhaustive-deps": "off",
    },
  },
];

export default eslintConfig;

