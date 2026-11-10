const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');

const source = fs.readFileSync(process.env.TEST_SOURCE || path.join(__dirname, '..', 'index.html'), 'utf8');
const origin = 'https://example.test/';

async function openApp(t, hash = '') {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM(source, {
    url: origin + hash,
    runScripts: 'dangerously',
    // Resource fetching is disabled. Only local app code is executed.
    virtualConsole,
    beforeParse(window) {
      window.__xssHits = [];
      window.__alerts = [];
      window.__prompts = [];
      window.__copied = [];
      window.alert = text => window.__alerts.push(text);
      window.prompt = (text, value) => window.__prompts.push({ text, value });
      window.Element.prototype.scrollIntoView = () => {};
      Object.defineProperty(window.navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async text => { window.__copied.push(text); } },
      });
    },
  });
  t.after(() => dom.window.close());
  await new Promise(resolve => dom.window.addEventListener('load', resolve));
  t.after(() => assert.deepEqual(errors, [], 'no uncaught app errors'));
  return dom.window;
}

function assertSafe(window, raw) {
  const document = window.document;
  const output = document.querySelector('#output');
  // jsdom does not fetch images. Dispatch their failure/load events explicitly
  // so a reintroduced inline event handler also produces an executable failure.
  for (const element of output.querySelectorAll('[onerror], [onload]')) {
    for (const type of ['error', 'load']) element.dispatchEvent(new window.Event(type));
  }
  assert.deepEqual([...window.__xssHits], [], 'payload must not execute');
  const elements = [...output.querySelectorAll('*')];
  assert.deepEqual(elements.filter(el => !['DIV', 'SPAN', 'MARQUEE', 'STRONG', 'BR', 'BUTTON'].includes(el.tagName))
    .map(el => el.outerHTML), [], 'payload must not create elements');
  assert.deepEqual(elements.flatMap(el => [...el.attributes]
    .filter(attr => /^on/i.test(attr.name)).map(attr => [el.tagName, attr.name, attr.value])), [
    ['BUTTON', 'onclick', 'shareDesign()'],
    ['BUTTON', 'onclick', 'saveAsImage()'],
    ['BUTTON', 'onclick', 'generate()'],
  ]);
  assert.ok(output.textContent.includes(raw), 'original text is literal');
  assert.ok(output.textContent.includes(raw.toUpperCase()), 'uppercase text is correct');
  assert.equal(document.querySelector('#userText').value, raw);
  assert.equal(decodeURIComponent(window.location.hash.slice(1)), raw);
  assert.equal(document.querySelectorAll('#generated').length, 1);
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
    const window = await openApp(t, '#' + encodeURIComponent(payload));
    assertSafe(window, payload);
    const reloaded = await openApp(t, window.location.hash);
    assertSafe(reloaded, payload);
  });
  test(`manual generation safely renders ${name}`, async t => {
    const window = await openApp(t);
    window.document.querySelector('#userText').value = payload;
    window.document.querySelector('.generate-btn').click();
    assertSafe(window, payload);
  });
}

test('each renderer preserves literal text without creating markup', async t => {
  const window = await openApp(t);
  const text = '<svg/onload=window.__xssHits.push(9)> &lt;b&gt; &#60; " \' 世界 🎨';
  for (const renderer of ['makeWordArt', 'makeMarquee', 'makeBlinkBlock', 'makeWordCloud']) {
    const host = window.document.createElement('section');
    host.innerHTML = window[renderer](text, 20, 40);
    assert.ok([...host.querySelectorAll('*')].every(el => ['DIV', 'SPAN', 'MARQUEE'].includes(el.tagName)), renderer);
    if (renderer === 'makeWordCloud') {
      for (const word of text.split(/\s+/)) assert.ok(host.textContent.includes(word), word);
    } else {
      assert.ok(host.textContent.includes(renderer === 'makeBlinkBlock' ? text.toUpperCase() : text), renderer);
    }
  }
});

test('normal shared links, regeneration, keyboard and share controls work', async t => {
  const text = 'Hello 世界 🎨 & <friends> "quoted" \'apostrophe\'\nSecond line &lt;literal&gt; # + %';
  const window = await openApp(t, '#' + encodeURIComponent(text));
  assertSafe(window, text);
  const originalUrl = window.location.href;
  window.document.querySelector('button[onclick="shareDesign()"]').click();
  await Promise.resolve();
  assert.deepEqual([...window.__copied], [originalUrl]);
  window.document.querySelector('button[onclick="saveAsImage()"]').click();
  assert.match(window.__alerts.at(-1), /To save as image/);
  window.document.querySelector('button[onclick="generate()"]').click();
  assertSafe(window, text);
  const input = window.document.querySelector('#userText');
  input.value = 'Second design';
  input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true }));
  assertSafe(window, 'Second design');
  const reloaded = await openApp(t, window.location.hash);
  assertSafe(reloaded, 'Second design');
  const shared = await openApp(t, new URL(originalUrl).hash);
  assertSafe(shared, text);
  Object.defineProperty(shared.navigator, 'clipboard', { value: undefined });
  shared.document.querySelector('button[onclick="shareDesign()"]').click();
  assert.equal(shared.__prompts.at(-1).value, originalUrl);
});

test('ordinary plain-text control works', async t => {
  const text = 'Hello 世界 🎨';
  const window = await openApp(t, '#' + encodeURIComponent(text));
  assertSafe(window, text);
});

test('empty input, trimming and malformed hashes retain behavior', async t => {
  const window = await openApp(t);
  const input = window.document.querySelector('#userText');
  input.value = '   ';
  window.document.querySelector('.generate-btn').click();
  assert.equal(window.document.querySelector('#generated'), null);
  assert.match(window.__alerts.at(-1), /TYPE SOMETHING FIRST/);
  input.value = '  trimmed  ';
  window.document.querySelector('.generate-btn').click();
  assert.equal(window.location.hash, '#trimmed');
  assert.ok(window.document.querySelector('#generated').textContent.includes('trimmed'));
  const malformed = await openApp(t, '#%E0%A4%A');
  assert.equal(malformed.document.querySelector('#generated'), null);
  assert.equal(malformed.document.querySelector('#userText').value, '');
});
