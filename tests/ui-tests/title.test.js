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

/*const timeout = 80000;
import fs from 'fs';
beforeAll(async () => {
  path = realpathSync('file://../index.html');
  await page.goto('file://' + path, {waitUntil: 'domcontentloaded'});
});

describe('Title of the page', () => {
  test('Title of the page', async () => {
    await page.waitForSelector('.wk-container');
    const richT = await page.$('.wk-wysiwyg');
    const newContent = await page.evaluate( x => {
      richT.innerHTML = x;
    }, '' );
    page.click('[title="Strong <strong> Ctrl+B"]');
    const firstB = await page.type('.wk-wysiwyg','initiate bold');
    console.log(firstB);
    //expect(firstB).toBe();

    await page.click('[title="Strong <strong> Ctrl+B"]');
    const secondB = await page.type('.wk-wysiwyg','unselect bold');
    //expect(secondB).toBe()
    const title = await page.title();
    expect(title).toBe('woofmark');

  }, timeout);
});*/