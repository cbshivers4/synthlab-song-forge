import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      // Newer Chrome returns Promises from scroll methods; an effect that returns one hands React a
      // non-function cleanup, which crashes the panel when it re-runs or closes. Use braces.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.name=/^use(Layout|Insertion)?Effect$/] > ArrowFunctionExpression[body.type='CallExpression'][body.callee.property.name=/^(scroll|focus|play|requestFullscreen)/]",
          message:
            "Wrap this effect body in braces so it returns nothing (scroll/play calls return Promises).",
        },
        {
          selector:
            "CallExpression[callee.name=/^use(Layout|Insertion)?Effect$/] > ArrowFunctionExpression[body.type='ChainExpression'][body.expression.callee.property.name=/^(scroll|focus|play|requestFullscreen)/]",
          message:
            "Wrap this effect body in braces so it returns nothing (scroll/play calls return Promises).",
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  eslintPluginPrettier,
  {
    // Generated, payment/webhook, account-deletion and Electron files are kept exactly as they are
    // (see .prettierignore), so formatting is not enforced there.
    files: [
      "src/integrations/supabase/**",
      "src/lib/paddle.ts",
      "src/lib/paddle.server.ts",
      "src/lib/paddle-webhook.server.ts",
      "src/utils/payments.functions.ts",
      "src/utils/account.functions.ts",
      "src/routes/api/**",
      "electron/**",
    ],
    rules: { "prettier/prettier": "off" },
  },
  {
    // Loose payment-provider payload types are left untouched on purpose; flag them, don't block.
    files: [
      "src/lib/paddle.ts",
      "src/lib/paddle-webhook.server.ts",
      "src/utils/payments.functions.ts",
    ],
    rules: { "@typescript-eslint/no-explicit-any": "warn" },
  },
);
