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
    "dist/**",
    ".sites-runtime/**",
    ".vinext/**",
    ".wrangler/**",
    "artifacts/**",
    "outputs/**",
    "native/mobile/dist-check/**",
    "next-env.d.ts",
  ]),
  {
    files: ["components/ui/**/*.{ts,tsx}", "hooks/use-mobile.ts"],
    rules: {
      // These files are vendored verbatim from shadcn@4.17.0. Keep the
      // registry source intact while applying the stricter rules to Site code.
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["app/admin/dashboard.tsx"],
    rules: {
      // The admin endpoint deliberately returns different row shapes for each
      // selected section; the UI narrows them with the active section.
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: ["native/desktop/**/*.cjs", "scripts/**/*.cjs"],
    rules: {
      // Electron's main process is CommonJS because Electron loads this file
      // directly from package.json.
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["app/amis/contact-card.tsx", "app/bienvenue/profile-setup.tsx", "app/fil/feed.tsx", "app/parametres/user-preferences.tsx"],
    rules: {
      // These images are local object URLs or authenticated endpoints. Next's
      // optimizer cannot fetch them without losing the user's session.
      "@next/next/no-img-element": "off",
    },
  },
  {
    files: ["native/mobile/App.tsx"],
    rules: {
      // React Native resolves bundled audio assets through require(). The
      // expo-audio player is an imperative object whose documented controls
      // mutate playback state outside React rendering.
      "@typescript-eslint/no-require-imports": "off",
      "react-hooks/immutability": "off",
    },
  },
]);

export default eslintConfig;
