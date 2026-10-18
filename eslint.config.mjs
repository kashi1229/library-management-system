import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    /*
     * The local QA harness.
     *
     * `qa17/` is a working folder for the browser and API passes — scripts that poke the
     * database, print to the console and cast freely because they are throwaway instruments,
     * not shipped code. It is already excluded from git through `.git/info/exclude`; this is
     * the matching exclude for the linter.
     *
     * Without it, `npm run lint` fails on a file nobody will ever ship, and the check that is
     * supposed to guard the codebase stops being run at all — which is how a real lint error
     * survives several units. The QA folder must never be the reason `npm run lint` is red.
     */
    "qa17/**",
  ]),
]);

export default eslintConfig;
