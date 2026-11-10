const { test } = require('node:test');
const assert = require('node:assert/strict');
const B = require('../engine.js');
const document = () => B.newDocument('Hello 世界 🎨 & <friends>\n第二行', 123456);

test('v2 exact full-state link roundtrip and defensive copies', () => {
  const d = document(); d.background = 'grid'; d.backgroundX = -123; d.backgroundY = 77; d.backgroundScale = 150;
  d.effects = {size: 3, pop: 2, gold: 1, clutter: 2, tilt: 0};
  d.stickers[0] = {id: 10, kind: 'disk', x: 65, y: 615, scale: 170, rotation: -180};
  d.photoX = 20; d.photoY = 45; d.photoScale = 120; d.photoRotation = 9; d.photoFilter = 'sepia';
  assert.deepEqual(B.decode(B.encode(d)), d);
  const copy = B.validate(d); copy.effects.size = 0; copy.stickers[0].x = 400;
  assert.equal(d.effects.size, 3); assert.equal(d.stickers[0].x, 65);
});

test('old text hashes are literal, deterministic and Unicode aware', () => {
  const text = '世界 🎨 & <script>alert(1)</script> # + %';
  const a = B.decode('#' + encodeURIComponent(text));
  assert.equal(a.text, text); assert.deepEqual(a, B.decode('#' + encodeURIComponent(text)));
  assert.deepEqual(B.decode(B.encode(a)), a);
  assert.equal(B.validate(B.newDocument('🎨'.repeat(500), 1)).text.length, 1000);
  assert.throws(() => B.validate(B.newDocument('🎨'.repeat(501), 1)));
  assert.equal(B.decode(''), null); assert.equal(B.decode('#'), null);
});

test('schema rejects malformed, huge, invalid, injected and remote-photo state', () => {
  for (const hash of ['#%', '#%E0%A4%A', '#bt2={', '#bt2=null', '#bt2=[]', '#'+'a'.repeat(24001)]) assert.throws(() => B.decode(hash), hash.slice(0,30));
  const patches = [ {v:1}, {text:''}, {text:'a'.repeat(501)}, {text:'\u0000'}, {text:'\ud800'}, {seed:-1}, {seed:1.5}, {seed:Infinity}, {seed:'1'}, {background:'url(https://evil.test)'}, {backgroundX:201}, {backgroundY:NaN}, {backgroundScale:0}, {photo:'https://evil.test/photo'}, {photo:'data:image/svg+xml,<svg onload=alert(1)>'}, {photoFilter:'url(https://evil.test)'}, {photoScale:201}, {effects:{}}, {stickers:Array(17).fill(document().stickers[0])} ];
  for (const patch of patches) assert.throws(() => B.validate({...document(), ...patch}), JSON.stringify(patch));
  for (const [key,value] of Object.entries({id:0, kind:'<script>', x:1e20, y:0, scale:NaN, rotation:181})) {
    const d = document(); d.stickers[0][key] = value; assert.throws(() => B.validate(d), key);
  }
  const d = document(); d.stickers[1].id = d.stickers[0].id; assert.throws(() => B.validate(d));
  const hostile = JSON.parse(JSON.stringify(document()).slice(0,-1)+',"__proto__":{"polluted":true},"extra":"discard"}');
  assert.equal(B.validate(hostile).extra, undefined); assert.equal({}.polluted, undefined);
});

test('feedback increments only its own effect, saturates, and leaves input immutable', () => {
  for (const [action, spec] of Object.entries(B.FEEDBACK)) {
    let d = document(); const before = B.clone(d); const next = B.applyFeedback(d, action);
    assert.deepEqual(d, before); const expected = B.clone(d); expected.effects[spec.key]++;
    assert.deepEqual(next, expected);
    while (d.effects[spec.key] < spec.max) d = B.applyFeedback(d, action);
    assert.equal(B.applyFeedback(d, action), null);
  }
  assert.throws(() => B.applyFeedback(document(), 'unknown'));
});

test('report follows active state and remains bounded; photos cannot be shared', () => {
  const d = document(), before = B.report(d);
  const next = B.applyFeedback(d, 'bigger'); assert.equal(B.report(next).score, before.score+5);
  assert.equal(B.report(next).details.length, before.details.length+1);
  for (const spec of Object.values(B.FEEDBACK)) d.effects[spec.key] = spec.max;
  assert.ok(B.report(d).score <= 100);
  d.photo = 'data:image/png;base64,AAAA'; assert.throws(() => B.encode(d), /PNG/);
});
