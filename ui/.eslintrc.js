module.exports = {
  root: true,
  env: {
    node: true,
    browser: true,
    es2020: true,
  },
  extends: ["plugin:vue/essential", "eslint:recommended", "@vue/prettier"],
  parserOptions: {
    parser: "@babel/eslint-parser",
    requireConfigFile: false,
  },
  rules: {
    "no-console": "off",
    "no-debugger": process.env.NODE_ENV === "production" ? "warn" : "off",
    // NS8 module views are conventionally named Status/Settings/About.
    "vue/multi-word-component-names": "off",
  },
  overrides: [
    {
      files: ["tests/unit/**/*.spec.js", "jest.config.js"],
      env: { jest: true, node: true },
    },
  ],
};
