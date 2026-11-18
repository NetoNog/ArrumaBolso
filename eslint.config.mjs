import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Third-party components vendored verbatim from React Bits; kept identical
    // to upstream (they rely on the "latest ref" pattern) so they can be updated.
    "src/components/landing/react-bits/**",
  ]),
]);

export default eslintConfig;
