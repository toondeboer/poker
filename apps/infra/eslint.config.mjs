// ESLint flat config for @poker/infra — CDK definitions and Lambda handlers.
// Syntactic (non-type-checked) rules only; `tsc --noEmit` covers type safety.
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
