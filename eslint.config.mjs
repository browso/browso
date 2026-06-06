import tseslint from "@electron-toolkit/eslint-config-ts";
import prettier from "@electron-toolkit/eslint-config-prettier";

export default tseslint.config(
  {
    ignores: ["node_modules/**", "out/**", "dist/**", "release/**", "coverage/**"],
  },
  tseslint.configs.recommended,
  prettier
);
