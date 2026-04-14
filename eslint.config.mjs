import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // react-hooks/set-state-in-effect flags valid patterns (localStorage init, data fetch spinners, derived modal state).
  {
    files: [
      "components/kitchen/KitchenBoard.tsx",
      "components/kitchen/KitchenMultiBoard.tsx",
      "hooks/useKitchenNewOrderPing.ts",
      "components/waiter/SeatGrid.tsx",
    ],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // PWA / Workbox emitted bundles
    "public/sw.js",
    "public/swe-worker-*.js",
    "public/workbox-*.js",
  ]),
]);

export default eslintConfig;
