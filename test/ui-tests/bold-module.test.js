const timeout = process.env.SLOWMO ? 130000 : 40000;
const fs = require('fs');
beforeAll(async () => {
  path = fs.realpathSync('file://../index.html');
  await page.goto('file://' + path, {waitUntil: 'domcontentloaded'});
});

describe('bold module work as expected', () => {

  test('bold text does not loose formatting after converting to markdown and back to rich', async () => {
    await page.evaluate(() => document.querySelector('.wk-wysiwyg').innerHTML = '');

    await page.waitForSelector('.wk-wysiwyg');
    await page.keyboard.type(' not using bold ');
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyB');
    await page.keyboard.up('Control');
    await page.keyboard.type('using bold '); 
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyB');
    await page.keyboard.up('Control');
    await page.keyboard.type('using new line');

    await page.keyboard.down('Control');
    await page.keyboard.press('KeyM');
    await page.keyboard.up('Control');
    await page.keyboard.type('writing in markdown mode');
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyP');
    await page.keyboard.up('Control');
    await page.keyboard.type('back writing in wysiwyg mode');

    const stringIsIncluded = await page.evaluate(() => document.querySelector('.wk-wysiwyg').innerHTML.includes('**using bold **'));
    expect(stringIsIncluded).toBe(false);

  }, timeout);
});