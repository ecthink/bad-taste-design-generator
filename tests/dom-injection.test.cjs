/* Optional real-browser suite. Uses in-memory routes; never sends input/photo data externally. */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const B = require('../engine.js');
const origin = 'http://127.0.0.1:8732';
const root = path.join(__dirname, '..');
let browser;
before(async () => { browser = await chromium.launch({headless:true, ...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {})}); });
after(async () => { if (browser) await browser.close(); });
async function open(t, hash = '', viewport = {width:1280,height:900}) {
  const context = await browser.newContext({viewport, reducedMotion:'reduce'});
  t.after(() => context.close());
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    const files = {'/':'index.html','/engine.js':'engine.js','/app.js':'app.js','/style.css':'style.css'};
    if (url.origin !== origin || !files[url.pathname]) return route.abort();
    return route.fulfill({contentType:url.pathname.endsWith('.js') ? 'text/javascript' : url.pathname.endsWith('.css') ? 'text/css' : 'text/html', body:fs.readFileSync(path.join(root, files[url.pathname]))});
  });
  await context.addInitScript(() => { window.__xssHits = []; });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin + '/' + hash); await page.locator('#generated').waitFor();
  t.after(() => assert.deepEqual(errors, []));
  return page;
}
const payloads = [
  '<img src=x onerror="window.__xssHits.push(1)">', '<svg/onload=window.__xssHits.push(2)>',
  '</text></svg><img src=x onerror="window.__xssHits.push(3)">', '<ImG sRc=x oNeRrOr="window.__xssHits.push(4)">',
  '<iframe srcdoc="<svg onload=parent.__xssHits.push(5)>"></iframe>', '&lt;img src=x onerror=window.__xssHits.push(6)&gt;',
  '%3Cimg%20src=x%20onerror=window.__xssHits.push(7)%3E', '<style>body{display:none}</style><a href="javascript:alert(1)">X</a>',
  'Hello 世界 🎨 & <friends> "quoted"\nSecond line # + %'
];
for (const [index, payload] of payloads.entries()) test(`browser literal text payload ${index}: legacy, v2, manual, reload`, async t => {
  const page = await open(t, '#' + encodeURIComponent(payload));
  const safe = async () => {
    assert.equal(await page.locator('#userText').inputValue(),payload);
    assert.equal(await page.locator('#generated title').first().textContent(),payload);
    assert.equal(await page.locator('#output img, #output iframe, #output script, #output [onload], #output [onerror]').count(),0);
    assert.deepEqual(await page.evaluate(()=>window.__xssHits),[]);
  };
  await safe(); await page.reload(); await safe();
  await page.goto(origin+'/'+B.encode(B.newDocument(payload,123))); await safe();
  await page.locator('#userText').fill(payload); await page.locator('#generateButton').click(); await safe();
});
test('browser feedback, keyboard transform and undo preserve exact share state', async t => {
  const page=await open(t);
  const before=await page.evaluate(()=>window.BadTasteApp.getDocument());
  await page.locator('[data-feedback="bigger"]').click();
  const after=await page.evaluate(()=>window.BadTasteApp.getDocument());
  assert.equal(after.effects.size,before.effects.size+1); assert.equal(after.seed,before.seed);
  await page.locator('#undoButton').click(); assert.deepEqual(await page.evaluate(()=>window.BadTasteApp.getDocument()),before);
  await page.getByRole('button',{name:'加入磁碟貼紙',exact:true}).click();
  await page.locator('#objectScale').fill('140'); await page.locator('#objectScale').press('Tab');
  await page.locator('[data-layer="4"]').press('ArrowRight');
  const edited=await page.evaluate(()=>window.BadTasteApp.getDocument());
  await page.reload(); assert.deepEqual(await page.evaluate(()=>window.BadTasteApp.getDocument()),edited);
});
test('browser PNG includes photo and has expected dimensions, links exclude photo', async t => {
  const page=await open(t);
  const fixture=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=80;c.height=60;const x=c.getContext('2d');x.fillStyle='#e85f77';x.fillRect(0,0,80,60);return c.toDataURL('image/png').split(',')[1];});
  await page.locator('#photoInput').setInputFiles({name:'fixture.png',mimeType:'image/png',buffer:Buffer.from(fixture,'base64')});
  await page.waitForFunction(()=>document.querySelector('#photoStatus').textContent.includes('已加入'));
  assert.equal(new URL(page.url()).hash,'');
  assert.equal(await page.locator('#shareButton').getAttribute('aria-disabled'),'true');
  await page.locator('#downloadButton').click();
  await page.locator('#downloadReady').waitFor({state:'visible'});
  const data=await page.locator('#pngDownload').getAttribute('href');
  const png=Buffer.from(data.split(',')[1],'base64');
  assert.equal(png.subarray(1,4).toString(),'PNG');
  assert.equal(png.readUInt32BE(16),1800); assert.equal(png.readUInt32BE(20),1360);
  assert.match(await page.locator('#generated image').getAttribute('href'),/^data:image\/png;base64,/);
});
test('390px layout has no horizontal overflow, motion is off', async t => {
  const page=await open(t,'',{width:390,height:844});
  const width=await page.evaluate(()=>({viewport:innerWidth,content:document.documentElement.scrollWidth}));
  assert.ok(width.content<=width.viewport);
  assert.equal(await page.locator('#motionToggle').getAttribute('aria-pressed'),'false');
  await page.locator('#generateButton').click();
  assert.equal(await page.locator('#sequenceDialog').isVisible(),false);
});
