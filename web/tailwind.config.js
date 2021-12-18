module.exports = {
  content: ["./index.html", "./src/*.tsx"],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        primary: "#00d1b2",
      },
    },
  },
};
