/* Pure, versioned document model. No HTML, URLs, or photo bytes from shared links. */
(function (root) {
  'use strict';
  const VERSION = 2, MAX_TEXT = 500, MAX_STICKERS = 16;
  const BACKGROUNDS = ['stars', 'checker', 'sunset', 'grid'];
  const STICKERS = ['star', 'fire', 'smile', 'disk', 'new', 'construction'];
  const FEEDBACK = {
    bigger: { label: '個字可唔可以再大啲？', key: 'size', max: 3, report: '字體已加大，老細隔離條街都睇到。' },
    pop: { label: '唔夠搶眼，要 POP 啲', key: 'pop', max: 3, report: '撞色同立體陰影加碼，視覺音量已扭大。' },
    premium: { label: '想要高級感，但要平', key: 'gold', max: 1, report: '已加金邊，預算仍然係零蚊。' },
    fill: { label: '仲有位，加多啲嘢', key: 'clutter', max: 3, report: '空白位已補上裝飾，呼吸空間逐步撤走。' },
    tilt: { label: '可唔可以活潑啲？', key: 'tilt', max: 3, report: '文字已傾斜，設計師條頸亦然。' }
  };
  const clone = value => JSON.parse(JSON.stringify(value));
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  function newDocument(text = '唔使靚，\n最緊要夠搶！', seed = Math.floor(Math.random() * 0xffffffff)) {
    return {
      v: VERSION, text, seed: seed >>> 0, background: BACKGROUNDS[seed % BACKGROUNDS.length],
      backgroundX: 0, backgroundY: 0, backgroundScale: 100,
      effects: { size: 0, pop: 1, gold: 0, clutter: 0, tilt: 1 },
      stickers: [
        { id: 1, kind: 'star', x: 126, y: 173, scale: 95, rotation: -12 },
        { id: 2, kind: 'fire', x: 750, y: 497, scale: 115, rotation: 8 },
        { id: 3, kind: 'new', x: 754, y: 153, scale: 105, rotation: 12 }
      ], photo: null, photoX: 450, photoY: 330, photoScale: 100, photoRotation: 0, photoFilter: 'normal'
    };
  }
  function assertNumber(n, lo, hi) {
    if (typeof n !== 'number' || !Number.isFinite(n) || n < lo || n > hi) throw Error('Invalid document value');
    return n;
  }
  function validate(value) {
    if (!value || value.v !== VERSION || typeof value.text !== 'string' || !value.text.trim() || [...value.text].length > MAX_TEXT) throw Error('Invalid document');
    // XML-invalid controls cannot be exported as SVG. Treat invalid links as errors, not partial loads.
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ud800-\udfff]/u.test(value.text)) throw Error('Invalid text');
    if (value.photo) throw Error('Photos cannot be loaded from links');
    const doc = newDocument(value.text, assertNumber(value.seed, 0, 0xffffffff));
    if (!Number.isInteger(value.seed) || !BACKGROUNDS.includes(value.background)) throw Error('Invalid background');
    doc.background = value.background;
    for (const key of ['backgroundX', 'backgroundY']) doc[key] = assertNumber(value[key], -200, 200);
    doc.backgroundScale = assertNumber(value.backgroundScale, 50, 200);
    if (!value.effects || !value.stickers || !Array.isArray(value.stickers) || value.stickers.length > MAX_STICKERS) throw Error('Invalid effects');
    for (const { key, max } of Object.values(FEEDBACK)) {
      doc.effects[key] = assertNumber(value.effects[key], 0, max);
      if (!Number.isInteger(doc.effects[key])) throw Error('Invalid effect');
    }
    const ids = new Set();
    doc.stickers = value.stickers.map(s => {
      if (!s || !STICKERS.includes(s.kind) || !Number.isInteger(s.id) || ids.has(s.id)) throw Error('Invalid sticker');
      ids.add(s.id);
      return { id: assertNumber(s.id, 1, 1000000), kind: s.kind, x: assertNumber(s.x, 65, 835), y: assertNumber(s.y, 65, 615), scale: assertNumber(s.scale, 40, 170), rotation: assertNumber(s.rotation, -180, 180) };
    });
    for (const [key, lo, hi] of [['photoX', 0, 900], ['photoY', 0, 680], ['photoScale', 40, 200], ['photoRotation', -180, 180]]) doc[key] = assertNumber(value[key], lo, hi);
    if (!['normal', 'mono', 'sepia'].includes(value.photoFilter)) throw Error('Invalid photo filter');
    doc.photoFilter = value.photoFilter;
    return doc;
  }
  function encode(doc) {
    if (doc.photo) throw Error('含相片作品只限下載 PNG，相片不會放入連結。');
    return '#bt2=' + encodeURIComponent(JSON.stringify(validate(doc)));
  }
  function decode(hash) {
    if (!hash || hash === '#') return null;
    if (hash.length > 24000) throw Error('連結太長，未能載入。');
    if (hash.startsWith('#bt2=')) return validate(JSON.parse(decodeURIComponent(hash.slice(5))));
    const text = decodeURIComponent(hash.slice(1)).trim();
    if (!text || [...text].length > MAX_TEXT) throw Error('舊連結文字太長，請縮短至 500 字。');
    let seed = 2166136261;
    for (const ch of text) seed = Math.imul(seed ^ ch.codePointAt(0), 16777619) >>> 0;
    const doc = newDocument(text, seed);
    return validate(doc);
  }
  function applyFeedback(doc, action) {
    const spec = FEEDBACK[action];
    if (!spec) throw Error('Unknown feedback');
    if (doc.effects[spec.key] >= spec.max) return null;
    const next = clone(doc);
    next.effects[spec.key] += 1;
    return next;
  }
  function report(doc) {
    const points = 18 + doc.effects.size * 5 + doc.effects.pop * 7 + doc.effects.gold * 12 + doc.effects.clutter * 5 + doc.effects.tilt * 4 + doc.stickers.length * 2 + (doc.photo ? 5 : 0);
    return { score: Math.min(100, points), details: Object.values(FEEDBACK).filter(s => doc.effects[s.key] > 0).map(s => `${s.report} (${doc.effects[s.key]}/${s.max})`) };
  }
  const api = { VERSION, MAX_TEXT, MAX_STICKERS, BACKGROUNDS, STICKERS, FEEDBACK, clone, clamp, newDocument, validate, encode, decode, applyFeedback, report };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BadTaste = api;
})(typeof window !== 'undefined' ? window : globalThis);
