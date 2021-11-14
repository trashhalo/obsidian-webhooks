const path = require("path");
const { defineConfig } = require("vite");

module.exports = defineConfig({
  build: {
    minify: true,
    lib: {
      entry: path.resolve(__dirname, "main.ts"),
      name: "ObsidianWebhooks",
      formats: ["cjs"],
    },
    rollupOptions: {
      external: ["obsidian"],
      output: {},
    },
  },
});
