const path = require("path");
const { defineConfig } = require("@vue/cli-service");

module.exports = defineConfig({
  transpileDependencies: false,
  css: {
    loaderOptions: {
      sass: {
        sassOptions: {
          silenceDeprecations: [
            "import",
            "global-builtin",
            "color-functions",
            "if-function",
            "legacy-js-api",
          ],
        },
      },
    },
  },
  publicPath: "./",
  configureWebpack: {
    optimization: {
      splitChunks: {
        maxSize: 500000,
      },
    },
  },
  chainWebpack: (config) => {
    // vue-loader 15 emits `import style0 from "<block>?vue&type=style..."`
    // for every <style> block. Extracted CSS modules have no default export,
    // so webpack 5 would report a missing export for every component. The
    // check cannot be scoped to the generated .vue modules through a rule
    // (verified with rule-level parser options), so it is disabled globally.
    // Trade-off: a typo in a named import is caught by ESLint/runtime instead
    // of the bundler. The CSS itself is emitted normally.
    config.module.set("parser", {
      javascript: { importExportsPresence: false },
    });
    // webpack 5 dropped Node polyfills; ns8-ui-lib only needs randomBytes().
    config.resolve.alias.set(
      "crypto",
      path.resolve(__dirname, "src/shims/crypto.js"),
    );
    // Never inline images as data URIs: NS8 needs a real module logo file.
    config.module
      .rule("images")
      .set("type", "asset/resource")
      .set("generator", { filename: "img/[name].[hash:8][ext]" })
      .set("parser", undefined);
  },
});
