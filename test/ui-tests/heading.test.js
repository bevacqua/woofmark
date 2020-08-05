const timeout = process.env.SLOWMO ? 60000 : 10000;
const fs = require('fs');
beforeAll(async () => {
  path = fs.realpathSync('file://../index.html');
  await page.goto('file://' + path, {waitUntil: 'domcontentloaded'});
});

describe('Heading Text', () => {
  test('Adding and switching between headings', async () => {
    await page.click('[title="Markdown Mode Ctrl+M"]');
    await page.click('#ta');

    await page.click('[title="Heading <h1>, <h2>, ... Ctrl+D"]');
    let stringIsIncluded = await page.evaluate(() => document.querySelector('#ta').value.includes('# Heading Text'));
    expect(stringIsIncluded).toBe(true);

    await page.click('[title="Heading <h1>, <h2>, ... Ctrl+D"]');
    stringIsIncluded = await page.evaluate(() => document.querySelector('#ta').value.includes('## Heading Text'));
    expect(stringIsIncluded).toBe(true);

    await page.click('[title="Heading <h1>, <h2>, ... Ctrl+D"]');
    stringIsIncluded = await page.evaluate(() => document.querySelector('#ta').value.includes('### Heading Text'));
    expect(stringIsIncluded).toBe(true);

    await page.click('[title="Heading <h1>, <h2>, ... Ctrl+D"]');
    stringIsIncluded = await page.evaluate(() => document.querySelector('#ta').value.includes('#### Heading Text'));
    expect(stringIsIncluded).toBe(true);

    await page.click('[title="Heading <h1>, <h2>, ... Ctrl+D"]');
    stringIsIncluded = await page.evaluate(() => document.querySelector('#ta').value.includes('Heading Text'));
    expect(stringIsIncluded).toBe(true);

  }, timeout);
});