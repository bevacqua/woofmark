
module.exports = {
  globals: {
    URL: "http://localhost:8080"
  },
  preset: "jest-puppeteer",
  testMatch: [
    "**/tests/**/*.test.js"
  ],
  verbose: true,
};
