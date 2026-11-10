const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const origin = 'http://127.0.0.1:8732';
let browser;

before(async () => {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  });
});
after(async () => { if (browser) await browser.close(); });

async function openPage(t, hash = '') {
  const context = await browser.newContext();
  t.after(() => context.close());
  // Serve only the app from memory. Never send payloads to an external server.
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === origin && url.pathname === '/') {
      return route.fulfill({ contentType: 'text/html; charset=utf-8', body: source });
    }
    return route.abort();
  });
  await context.addInitScript(() => {
    window.__xssHits = [];
    window.__alerts = [];
    window.__prompts = [];
    window.__copied = [];
    window.alert = text => window.__alerts.push(text);
    window.prompt = (text, value) => window.__prompts.push({ text, value });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async text => { window.__copied.push(text); } },
    });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin + '/' + hash);
  t.after(() => assert.deepEqual(errors, [], 'no uncaught browser errors'));
  return page;
}

async function assertSafe(page, raw) {
  // Structural assertions catch inert markup as well as delayed event handlers.
  await page.waitForTimeout(100);
  const state = await page.evaluate(() => ({
    hits: window.__xssHits,
    text: document.querySelector('#generated').textContent,
    input: document.querySelector('#userText').value,
    hash: decodeURIComponent(location.hash.slice(1)),
    unexpected: [...document.querySelectorAll('#output *')]
      .filter(el => !['DIV', 'SPAN', 'MARQUEE', 'STRONG', 'BR', 'BUTTON'].includes(el.tagName))
      .map(el => el.outerHTML),
    handlers: [...document.querySelectorAll('#output *')].flatMap(el =>
      [...el.attributes].filter(attr => /^on/i.test(attr.name)).map(attr => [el.tagName, attr.name, attr.value])),
  }));
  assert.deepEqual(state.hits, [], 'payload must not execute');
  assert.deepEqual(state.unexpected, [], 'payload must not create elements');
  assert.deepEqual(state.handlers, [
    ['BUTTON', 'onclick', 'shareDesign()'],
    ['BUTTON', 'onclick', 'saveAsImage()'],
    ['BUTTON', 'onclick', 'generate()'],
  ], 'only the existing trusted action handlers remain');
  assert.ok(state.text.includes(raw), 'original text is displayed literally');
  assert.ok(state.text.includes(raw.toUpperCase()), 'uppercase text remains correct');
  assert.equal(state.input, raw);
  assert.equal(state.hash, raw, 'sharing retains original text, not encoded HTML');
}

const payloads = {
  image: '<img src=x onerror="window.__xssHits.push(1)">',
  svg: '<svg/onload=window.__xssHits.push(2)>',
  breakout: '</span></div><img src=x onerror="window.__xssHits.push(3)">',
  mixedCase: '<ImG sRc=x oNeRrOr="window.__xssHits.push(4)">',
  srcdoc: '<iframe srcdoc="<svg onload=parent.__xssHits.push(5)>"></iframe>',
  entities: '&lt;img src=x onerror=window.__xssHits.push(6)&gt; &#60;svg&#62;',
  encoded: '%3Cimg%20src=x%20onerror=window.__xssHits.push(7)%3E',
  markup: '<style>body{display:none}</style><a href="javascript:window.__xssHits.push(8)">click</a>',
};

for (const [name, payload] of Object.entries(payloads)) {
  test(`hash load safely renders ${name}`, async t => {
    const page = await openPage(t, '#' + encodeURIComponent(payload));
    await assertSafe(page, payload);
    await page.reload();
    await assertSafe(page, payload);
  });
  test(`manual generation safely renders ${name}`, async t => {
    const page = await openPage(t);
    await page.locator('#userText').fill(payload);
    await page.locator('.generate-btn').click();
    await assertSafe(page, payload);
  });
}

test('each text renderer independently preserves literal input', async t => {
  const page = await openPage(t);
  const text = '<svg/onload=window.__xssHits.push(9)> &lt;b&gt; &#60; " \' 世界 🎨';
  for (const renderer of ['makeWordArt', 'makeMarquee', 'makeBlinkBlock', 'makeWordCloud']) {
    const result = await page.evaluate(({ renderer, text }) => {
      const host = document.createElement('section');
      host.innerHTML = window[renderer](text, 20, 40);
      document.body.append(host);
      const nodes = [...host.querySelectorAll('*')].map(el => el.tagName);
      const rendered = host.textContent;
      host.remove();
      return { nodes, rendered };
    }, { renderer, text });
    assert.ok(result.nodes.every(tag => ['DIV', 'SPAN', 'MARQUEE'].includes(tag)), renderer);
    if (renderer === 'makeWordCloud') {
      for (const word of text.split(/\s+/)) assert.ok(result.rendered.includes(word), word);
    } else {
      assert.ok(result.rendered.includes(renderer === 'makeBlinkBlock' ? text.toUpperCase() : text), renderer);
    }
  }
  assert.deepEqual(await page.evaluate(() => window.__xssHits), []);
});

test('normal shared links, repeated generation and controls remain functional', async t => {
  const text = 'Hello 世界 🎨 & <friends> "quoted" \'apostrophe\'\nSecond line &lt;literal&gt; # + %';
  const page = await openPage(t, '#' + encodeURIComponent(text));
  await assertSafe(page, text);
  const originalUrl = page.url();
  await page.locator('button[onclick="shareDesign()"]').click();
  assert.deepEqual(await page.evaluate(() => window.__copied), [originalUrl]);
  await page.locator('button[onclick="saveAsImage()"]').click();
  assert.match(await page.evaluate(() => window.__alerts.at(-1)), /To save as image/);
  await page.locator('button[onclick="generate()"]').click();
  await assertSafe(page, text);
  await page.locator('#userText').fill('Second design');
  await page.locator('#userText').press('Control+Enter');
  await assertSafe(page, 'Second design');
  assert.equal(await page.locator('#generated').count(), 1);
  await page.reload();
  await assertSafe(page, 'Second design');
  // Previously copied links must still decode and display the same text.
  await page.goto(origin + '/');
  await page.goto(originalUrl);
  await assertSafe(page, text);
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { value: undefined }));
  await page.locator('button[onclick="shareDesign()"]').click();
  assert.equal(await page.evaluate(() => window.__prompts.at(-1).value), originalUrl);
});

test('empty input, trimming and malformed hashes keep existing behavior', async t => {
  const page = await openPage(t);
  assert.equal(await page.locator('#generated').count(), 0);
  await page.locator('#userText').fill('   ');
  await page.locator('.generate-btn').click();
  assert.equal(await page.locator('#generated').count(), 0);
  assert.match(await page.evaluate(() => window.__alerts.at(-1)), /TYPE SOMETHING FIRST/);
  await page.locator('#userText').fill('  trimmed  ');
  await page.locator('.generate-btn').click();
  assert.equal(new URL(page.url()).hash, '#trimmed');
  assert.ok((await page.locator('#generated').textContent()).includes('trimmed'));
  await page.goto(origin + '/#%E0%A4%A');
  await page.reload();
  assert.equal(await page.locator('#generated').count(), 0);
  assert.equal(await page.locator('#userText').inputValue(), '');
});
