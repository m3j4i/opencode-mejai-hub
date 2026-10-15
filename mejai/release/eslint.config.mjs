export default [
  {
    files: ["**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: Object.fromEntries(
        [
          "Buffer",
          "process",
          "console",
          "structuredClone",
          "fetch",
          "AbortSignal",
          "setTimeout",
        ].map((name) => [name, "readonly"]),
      ),
    },
    rules: {
      "no-undef": "error",
      "no-shadow": "error",
      "no-unreachable": "error",
      "no-dupe-keys": "error",
      "no-unused-vars": ["error", { args: "none", caughtErrors: "none" }],
    },
  },
];
