module.exports = {
  content: ["./index.html", "./src/*.tsx"],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#f2fdfb",
          100: "#e6faf7",
          200: "#bff4ec",
          300: "#99ede0",
          400: "#4ddfc9",
          500: "#00d1b2",
          600: "#00bca0",
          700: "#009d86",
          800: "#007d6b",
          900: "#006657",
        },
      },
    },
  },
};
