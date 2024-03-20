const timeout = process.env.SLOWMO ? 60000 : 10000;
const fs = require('fs');
beforeAll(async () => {
  path = fs.realpathSync('file://../index.html');
  await page.goto('file://' + path, {waitUntil: 'domcontentloaded'});
});

describe('Title of the page', () => {
  test('Title of the page', async () => {
    const title = await page.title();
    expect(title).toBe('woofmark');

  }, timeout);
});