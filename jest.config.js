module.exports = {
    globals: {
      URL: 'http://localhost:8080'
    },
    preset: 'jest-puppeteer',
    testMatch: [
      '**/test/**/*.test.js'
    ],
    verbose: true,
  };