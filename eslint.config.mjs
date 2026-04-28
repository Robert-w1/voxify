import pluginImport from "eslint-plugin-import";
import pluginPrettier from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";

export default [
  {
    files: ["app/javascript/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        fetch: "readonly",
        FormData: "readonly",
        MediaRecorder: "readonly",
        AudioContext: "readonly",
        navigator: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        URL: "readonly",
        Blob: "readonly",
        Event: "readonly",
      },
    },
    plugins: {
      import: pluginImport,
      prettier: pluginPrettier,
    },
    rules: {
      ...prettierConfig.rules,
      "prettier/prettier": "error",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-console": "warn",
      "import/no-duplicates": "error",
    },
  },
  {
    ignores: ["node_modules/**", "public/assets/**", "vendor/**"],
  },
];
