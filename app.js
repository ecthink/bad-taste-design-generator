/* The displayed SVG is also the PNG export source. All user strings use textContent. */
(() => {
  'use strict';
  const B = window.BadTaste, $ = id => document.getElementById(id), NS = 'http://www.w3.org/2000/svg';
  const names = { star: '閃星', fire: '火焰', smile: '笑哈哈', disk: '磁碟', new: 'NEW!', construction: '裝修中' };
  const backgroundNames = { stars: '星空', checker: '棋盤', sunset: '日落', grid: '網格' };
  let doc = B.newDocument(undefined, 1997), history = [], selected = '', photoReadVersion = 0;
  let exporting = false, photoBusy = false, sequenceTimer = null, sequenceDone = null, toastTimer;
  let revision = 0, editVersion = 0, drag = null, photoUnsaved = false;
  const reduced = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: true };
  function node(tag, attrs = {}, text) {
    const el = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function add(parent, tag, attrs, text) { const el = node(tag, attrs, text); parent.append(el); return el; }
  function say(text) {
    $('status').textContent = text;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('status').textContent = ''; }, 6500);
  }
  function snapshot() { return { ...doc, effects: { ...doc.effects }, stickers: doc.stickers.map(s => ({ ...s })) }; }
  function remember(before = snapshot()) { history.push(before); if (history.length > 20) history.shift(); revision++; }
  function syncURL() {
    const fragment = doc.photo ? '' : B.encode(doc);
    try { window.history.replaceState(null, '', window.location.pathname + window.location.search + fragment); }
    catch { /* file:// or sandboxed previews can forbid history writes; explicit sharing still works. */ }
  }
  function changed(message, updateInputs = false) {
    editVersion++;
    $('copyFallback').hidden = true;
    $('downloadReady').hidden = true; $('pngDownload').removeAttribute('href');
    if (doc.photo) photoUnsaved = true;
    render(updateInputs); syncURL();
    if (message) say(message);
  }
  function change(fn, message) { remember(); fn(); changed(message); }
  function stickerArtwork(kind) {
    const g = node('g');
    if (kind === 'star') {
      add(g, 'polygon', { points: '0,-57 15,-19 56,-18 25,8 36,49 0,26 -36,49 -25,8 -56,-18 -15,-19', fill: '#ffe44c', stroke: '#f47e26', 'stroke-width': 5 });
      add(g, 'path', { d: 'M-17 -17 L-8 -36 M-29 -12 L-18 -14', stroke: '#fffbd4', 'stroke-width': 5, 'stroke-linecap': 'round' });
      add(g, 'circle', { cx: -10, cy: -2, r: 3, fill: '#542a33' }); add(g, 'circle', { cx: 10, cy: -2, r: 3, fill: '#542a33' });
    } else if (kind === 'fire') {
      add(g, 'path', { d: 'M0 -64 C20 -28 38 -25 33 -52 C78 6 54 55 0 61 C-65 51 -61 3 -27 -24 C-34 9 -12 10 0 -64Z', fill: '#ff3d59', stroke: '#ffd454', 'stroke-width': 5 });
      add(g, 'path', { d: 'M3 -18 C35 18 31 45 0 49 C-28 42 -26 18 -10 2 C-12 19 3 20 3 -18Z', fill: '#ffd651' });
    } else if (kind === 'smile') {
      add(g, 'circle', { r: 47, fill: '#e2ff3c', stroke: '#17153f', 'stroke-width': 5 });
      add(g, 'ellipse', { cx: -16, cy: -10, rx: 5, ry: 11, fill: '#17153f' }); add(g, 'ellipse', { cx: 16, cy: -10, rx: 5, ry: 11, fill: '#17153f' });
      add(g, 'path', { d: 'M-27 14 Q0 49 27 14', stroke: '#17153f', 'stroke-width': 5, fill: 'none', 'stroke-linecap': 'round' });
    } else if (kind === 'disk') {
      add(g, 'path', { d: 'M-45 -48 H33 L47 -34 V47 H-45Z', fill: '#8877c1', stroke: '#17153f', 'stroke-width': 5 });
      add(g, 'rect', { x: -25, y: -46, width: 48, height: 35, fill: '#d6d7df', stroke: '#17153f', 'stroke-width': 3 });
      add(g, 'rect', { x: 6, y: -40, width: 10, height: 22, fill: '#434566' });
      add(g, 'rect', { x: -29, y: 7, width: 59, height: 40, fill: '#fff9d8', stroke: '#17153f', 'stroke-width': 3 });
      add(g, 'text', { x: 0, y: 30, 'text-anchor': 'middle', fill: '#df277b', 'font-family': 'monospace', 'font-size': 13, 'font-weight': 'bold' }, 'SAVE ME');
    } else if (kind === 'new') {
      add(g, 'polygon', { points: '0,-48 10,-31 33,-42 34,-18 58,-12 42,7 54,28 28,29 20,50 0,36 -19,49 -27,27 -53,29 -42,8 -56,-12 -33,-19 -31,-42 -10,-31', fill: '#ff5fab', stroke: '#fff688', 'stroke-width': 4 });
      add(g, 'text', { x: 0, y: 8, 'text-anchor': 'middle', fill: '#26133e', 'font-family': 'Arial Black, sans-serif', 'font-style': 'italic', 'font-size': 25, 'font-weight': '900' }, 'NEW!');
    } else {
      add(g, 'rect', { x: -65, y: -24, width: 130, height: 48, fill: '#fadb47', stroke: '#201d38', 'stroke-width': 5 });
      for (let x = -63; x < 65; x += 22) add(g, 'path', { d: `M${x} -24 l14 0 -12 10 -14 0Z M${x} 24 l14 0 12 -10 -14 0Z`, fill: '#201d38' });
      add(g, 'text', { x: 0, y: 6, 'text-anchor': 'middle', fill: '#201d38', 'font-family': 'Arial, sans-serif', 'font-size': 15, 'font-weight': 'bold' }, '裝修中');
    }
    return g;
  }
  function drawBackground(svg) {
    const defs = add(svg, 'defs');
    const scale = doc.backgroundScale / 100;
    const pattern = add(defs, 'pattern', { id: 'pattern', width: 80, height: 80, patternUnits: 'userSpaceOnUse', patternTransform: `translate(${doc.backgroundX} ${doc.backgroundY}) scale(${scale})` });
    if (doc.background === 'stars') {
      add(pattern, 'rect', { width: 80, height: 80, fill: '#171542' });
      add(pattern, 'path', { d: 'M15 8v10m-5-5h10 M58 46v7m-3.5-3.5h7', stroke: '#a994c9', 'stroke-width': 1 });
      add(pattern, 'circle', { cx: 39, cy: 68, r: 1.5, fill: '#f5d958' });
    } else if (doc.background === 'checker') {
      add(pattern, 'rect', { width: 80, height: 80, fill: '#322056' });
      add(pattern, 'path', { d: 'M0 0h40v40H0z M40 40h40v40H40z', fill: '#723974' });
    } else if (doc.background === 'grid') {
      add(pattern, 'rect', { width: 80, height: 80, fill: '#102937' });
      add(pattern, 'path', { d: 'M0 0H80V80H0Z M40 0V80 M0 40H80', stroke: '#297a7c', 'stroke-width': 1, fill: 'none' });
    } else {
      const gradient = add(defs, 'linearGradient', { id: 'sunset', x1: '0%', y1: '0%', x2: '0%', y2: '100%' });
      add(gradient, 'stop', { offset: '0%', 'stop-color': '#3d226a' }); add(gradient, 'stop', { offset: '55%', 'stop-color': '#ca4e86' }); add(gradient, 'stop', { offset: '100%', 'stop-color': '#ef9d60' });
      add(pattern, 'rect', { width: 80, height: 80, fill: 'none' });
      add(pattern, 'path', { d: 'M0 10H80 M0 30H80 M0 50H80 M0 70H80', stroke: '#ffa0a1', opacity: '.2' });
      add(svg, 'rect', { width: 900, height: 680, fill: 'url(#sunset)' });
    }
    add(svg, 'rect', { width: 900, height: 680, fill: 'url(#pattern)' });
    const mono = add(defs, 'filter', { id: 'photo-mono', 'color-interpolation-filters': 'sRGB' });
    add(mono, 'feColorMatrix', { type: 'saturate', values: '0' });
    const sepia = add(defs, 'filter', { id: 'photo-sepia', 'color-interpolation-filters': 'sRGB' });
    add(sepia, 'feColorMatrix', { type: 'matrix', values: '.393 .769 .189 0 0 .349 .686 .168 0 0 .272 .534 .131 0 0 0 0 0 1 0' });
  }
  function textLines(text, width, size) {
    // Deterministic width approximation works without remote fonts or canvas measurements.
    const lines = []; let line = '', units = 0;
    for (const ch of text) {
      if (ch === '\n') { lines.push(line); line = ''; units = 0; continue; }
      const weight = /[\u0000-\u00ff]/.test(ch) ? (ch === ' ' ? .32 : .61) : 1;
      if (units + weight > width / size && line) { lines.push(line); line = ''; units = 0; }
      line += ch; units += weight;
    }
    lines.push(line); return lines;
  }
  function drawTitle(svg) {
    let size = 62 + doc.effects.size * 10;
    const displayText = doc.text.split('\n').length > 12 ? doc.text.replace(/\s+/g, ' ') : doc.text;
    let lines = textLines(displayText, 680, size);
    while ((lines.length * size * 1.22 > (doc.photo ? 210 : 290) || lines.length > 12) && size > 13) { size -= 1; lines = textLines(displayText, 680, size); }
    const y = doc.photo ? 457 : 330;
    const g = add(svg, 'g', { transform: `translate(450 ${y}) rotate(${-doc.effects.tilt * 2})` });
    const lineHeight = size * 1.22, start = -(lines.length - 1) * lineHeight / 2;
    const fill = doc.effects.gold ? '#ffdc68' : ['#f4f0d8', '#e3ff6b', '#76fbf2', '#ff78be'][doc.effects.pop];
    // Literal source text remains present in an accessible title even when split into visual lines.
    add(g, 'title', {}, doc.text);
    const paint = (dx, dy, color, strokeWidth, stroke) => {
      const t = add(g, 'text', { x: dx, y: start + dy, 'text-anchor': 'middle', 'font-family': "'Arial Black', 'Noto Sans CJK TC', 'Microsoft JhengHei', sans-serif", 'font-weight': '900', 'font-size': size, 'letter-spacing': 1, fill: color, 'paint-order': 'stroke', stroke: stroke || color, 'stroke-width': strokeWidth, 'stroke-linejoin': 'round', 'aria-hidden': 'true' });
      lines.forEach((line, i) => add(t, 'tspan', { x: dx, dy: i ? lineHeight : 0 }, line));
    };
    paint(8 + doc.effects.pop * 3, 10 + doc.effects.pop * 3, '#090a2c', 8);
    if (doc.effects.pop) paint(4 + doc.effects.pop, 5 + doc.effects.pop, '#f4419e', 5);
    paint(0, 0, fill, 2, doc.effects.gold ? '#70431d' : '#33204b');
  }
  function drawLayer(svg, item, isPhoto = false) {
    const id = isPhoto ? 'photo' : String(item.id);
    const g = add(svg, 'g', { transform: `translate(${item.x} ${item.y}) rotate(${item.rotation}) scale(${item.scale / 100})`, 'data-layer': id, tabindex: 0, role: 'button', 'aria-label': isPhoto ? '相片，按方向鍵移動' : `${names[item.kind]}貼紙，按方向鍵移動` });
    if (isPhoto) {
      add(g, 'rect', { x: -215, y: -165, width: 430, height: 350, fill: '#fff7dc', stroke: '#17183d', 'stroke-width': 3 });
      const attrs = { x: -200, y: -150, width: 400, height: 300, href: doc.photo, preserveAspectRatio: 'xMidYMid meet' };
      if (doc.photoFilter !== 'normal') attrs.filter = `url(#photo-${doc.photoFilter})`;
      add(g, 'image', attrs);
      add(g, 'text', { x: 0, y: 173, fill: '#5d4162', 'text-anchor': 'middle', 'font-family': 'monospace', 'font-size': 12 }, 'MEMORIES.JPG · KEEP FOREVER');
    } else g.append(stickerArtwork(item.kind));
    add(g, 'rect', { class: 'hitbox', x: isPhoto ? -220 : -65, y: isPhoto ? -170 : -65, width: isPhoto ? 440 : 130, height: isPhoto ? 360 : 130, fill: 'transparent', stroke: selected === id ? '#fff' : 'none', 'stroke-width': 2, 'stroke-dasharray': '6 4', 'data-editor-only': 'true' });
  }
  function buildSVG() {
    const svg = node('svg', { id: 'generated', viewBox: '0 0 900 680', width: 900, height: 680, role: 'group', 'aria-label': `作品：${doc.text}` });
    drawBackground(svg);
    const frame = doc.effects.gold ? '#f9d66c' : '#7ce8db';
    add(svg, 'rect', { x: 15, y: 15, width: 870, height: 650, fill: 'none', stroke: frame, 'stroke-width': doc.effects.gold ? 9 : 3 });
    add(svg, 'rect', { x: 25, y: 25, width: 850, height: 630, fill: 'none', stroke: doc.effects.gold ? '#9b5c27' : '#c359aa', 'stroke-width': 2, 'stroke-dasharray': '3 9' });
    add(svg, 'rect', { x: 253, y: 46, width: 394, height: 34, fill: '#cfff57', stroke: '#161332', 'stroke-width': 2 });
    add(svg, 'text', { x: 450, y: 69, 'text-anchor': 'middle', 'font-family': 'monospace', 'font-size': 17, 'font-weight': 'bold', 'letter-spacing': 3, fill: '#272044' }, 'WELCOME TO MY HOMEPAGE');
    add(svg, 'text', { x: 450, y: 119, 'text-anchor': 'middle', 'font-family': 'monospace', 'font-size': 14, 'letter-spacing': 4, fill: '#fff0cc' }, '★ 個 人 主 頁 · 不 接 受 批 評 ★');
    for (let i = 0; i < 7 + doc.effects.clutter * 9; i++) {
      const x = 55 + ((doc.seed + i * 137) % 790), y = 143 + ((doc.seed * 3 + i * 89) % 414);
      add(svg, 'text', { x, y, fill: ['#ff91ca','#bbff8c','#ffe978'][i % 3], 'font-size': 14 + i % 3 * 5, opacity: .8 }, i % 2 ? '✦' : '·');
    }
    if (doc.photo) drawLayer(svg, { x: doc.photoX, y: doc.photoY, scale: doc.photoScale, rotation: doc.photoRotation }, true);
    drawTitle(svg);
    add(svg, 'text', { x: 450, y: 569, 'text-anchor': 'middle', 'font-family': 'monospace', 'font-size': 14, 'letter-spacing': 4, fill: '#ffb8e0' }, '~ * +  做 人 最 緊 要 有 自 己 風 格  + * ~');
    add(svg, 'rect', { x: 235, y: 594, width: 430, height: 32, fill: '#12122b', stroke: '#b1a2cb' });
    add(svg, 'text', { x: 450, y: 615, 'text-anchor': 'middle', 'font-family': 'monospace', 'font-size': 12, 'letter-spacing': 1, fill: '#deff93' }, 'NO TASTE · NO PROBLEM · BEST VIEWED IN 1997');
    doc.stickers.forEach(item => drawLayer(svg, item));
    return svg;
  }
  function currentObject() {
    if (selected === 'photo' && doc.photo) return { x: doc.photoX, y: doc.photoY, scale: doc.photoScale, rotation: doc.photoRotation };
    return doc.stickers.find(s => String(s.id) === selected);
  }
  function setObject(key, value) {
    if (selected === 'photo') doc['photo' + key[0].toUpperCase() + key.slice(1)] = value;
    else { const item = currentObject(); if (item) item[key] = value; }
  }
  function bounds(key) {
    if (key === 'rotation') return [-180, 180];
    if (key === 'scale') return [40, selected === 'photo' ? 200 : 170];
    return selected === 'photo' ? [0, key === 'x' ? 900 : 680] : [65, key === 'x' ? 835 : 615];
  }
  function renderSelection() {
    const obj = currentObject();
    if (!obj) selected = '';
    $('layerSelect').value = selected;
    $('transformControls').hidden = !obj;
    $('deleteSticker').hidden = selected === 'photo';
    $('selectionHint').textContent = obj ? '已選取：' + (selected === 'photo' ? '相片' : names[obj.kind]) : '點貼紙可移動及縮放';
    if (obj) for (const key of ['x','y','scale','rotation']) {
      const el = $('object' + key[0].toUpperCase() + key.slice(1)), [min, max] = bounds(key);
      el.min = min; el.max = max; el.value = Math.round(obj[key]);
    }
  }
  function render(updateInput = false) {
    $('artboard').replaceChildren(buildSVG());
    if (updateInput) $('userText').value = doc.text;
    $('charCount').textContent = [...$('userText').value].length;
    $('undoButton').disabled = !history.length || exporting || photoBusy;
    $('downloadButton').disabled = exporting || photoBusy;
    $('downloadButton').textContent = exporting ? '正在製作 PNG…' : '↓ 下載 PNG';
    $('shareButton').setAttribute('aria-disabled', String(!!doc.photo || photoBusy));
    $('shareButton').textContent = doc.photo ? '🔒 相片作品請下載 PNG' : '↗ 複製完整作品連結';
    $('shareNotice').textContent = doc.photo ? '含相片作品只限下載 PNG。相片不會上傳或放入連結；關閉或重新整理會清除相片，請先下載。' : '文字＋內置素材：連結會保留版面、貼紙位置同所有效果。字型或會因裝置略有不同。';
    $('shareNotice').classList.toggle('photo-warning', !!doc.photo);
    $('photoControls').hidden = !doc.photo; $('photoFilter').value = doc.photoFilter;
    $('revisionCount').textContent = revision + ' 次';
    for (const button of $('feedbackButtons').children) {
      const spec = B.FEEDBACK[button.dataset.feedback];
      button.disabled = doc.effects[spec.key] >= spec.max;
      button.querySelector('span').textContent = `${doc.effects[spec.key]}/${spec.max} ${button.disabled ? '已到極限' : '再改少少'}`;
    }
    for (const button of $('backgrounds').children) button.setAttribute('aria-pressed', String(doc.background === button.dataset.background));
    for (const key of ['backgroundScale', 'backgroundX', 'backgroundY']) $(key).value = doc[key];
    $('backgroundScaleValue').textContent = doc.backgroundScale + '%';
    const options = [new Option('未選擇', '')];
    if (doc.photo) options.push(new Option('本機相片', 'photo'));
    doc.stickers.forEach(s => options.push(new Option(`${names[s.kind]} #${s.id}`, String(s.id))));
    $('layerSelect').replaceChildren(...options); renderSelection();
    const report = B.report(doc);
    $('badnessScore').textContent = report.score; $('badnessMeter').value = report.score;
    $('reportTitle').textContent = report.score >= 80 ? '恭喜，客戶應該會話「差少少」。' : report.score >= 50 ? '品味已離開聊天室。' : '仲有少少品味，請繼續努力。';
    $('reportDetails').replaceChildren(...report.details.map(text => { const li = document.createElement('li'); li.textContent = text; return li; }));
    $('stickerReport').textContent = `現場證物：${doc.stickers.length} 張貼紙 · ${backgroundNames[doc.background]}背景` + (doc.photo ? ' · 1 張本機相片' : '');
  }
  function select(value, focus = false) {
    selected = value;
    const old = $('artboard').querySelectorAll('.hitbox'); old.forEach(el => el.setAttribute('stroke', el.parentElement.dataset.layer === selected ? '#fff' : 'none'));
    renderSelection();
    if (focus) $('layerSelect').focus();
  }
  function finishSequence() {
    if (!sequenceDone) return;
    clearInterval(sequenceTimer); sequenceTimer = null;
    const done = sequenceDone; sequenceDone = null;
    if ($('sequenceDialog').open) $('sequenceDialog').close();
    done();
  }
  function generate() {
    if (sequenceDone || photoBusy) return;
    const raw = $('userText').value.trim();
    if (!raw) { say('打幾隻字先啦！'); $('userText').focus(); return; }
    if ([...raw].length > B.MAX_TEXT || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\ud800-\udfff]/u.test(raw)) { say('請輸入最多 500 字，並移除無效控制字元。'); return; }
    const make = () => {
      remember(); const photo = {};
      for (const key of ['photo','photoX','photoY','photoScale','photoRotation','photoFilter']) photo[key] = doc[key];
      doc = { ...B.newDocument(raw), ...photo }; selected = '';
      $('feedbackStatus').textContent = '新一輪改稿開始。所有意見都可以撤銷。';
      changed('品味移除完成。歡迎繼續改稿。', true);
      $('downloadButton').focus({ preventScroll: true });
    };
    if ($('skipSequence').checked || reduced.matches || typeof $('sequenceDialog').showModal !== 'function') { make(); return; }
    sequenceDone = make; let step = 0;
    $('sequenceText').textContent = '正在卸載：留白.dll'; $('sequenceProgress').value = 0;
    $('sequenceDialog').showModal(); $('skipAnimation').focus();
    sequenceTimer = setInterval(() => {
      step++; $('sequenceProgress').value = step;
      $('sequenceText').textContent = ['正在卸載：留白.dll', '正在停用：字體配搭.sys', '正在安裝：客戶意見.exe'][Math.min(step, 2)];
      if (step >= 3) finishSequence();
    }, 650);
  }
  async function loadPhoto(file) {
    if (!file) return;
    if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024 || !file.size) { $('photoStatus').textContent = '請選擇 10 MB 內嘅 JPG、PNG 或 WebP，相片未有改動。'; return; }
    const version = ++photoReadVersion;
    photoBusy = true; render(); $('photoStatus').textContent = '本機處理中，相片不會上傳…';
    try {
      const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(Error('未能讀取相片。')); reader.readAsDataURL(file); });
      const image = await new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(Error('相片格式無效或檔案已損壞。')); img.src = data; });
      if (image.naturalWidth * image.naturalHeight > 32000000) throw Error('相片超過 3200 萬像素，請先縮細。');
      const ratio = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio)); canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
      const context = canvas.getContext('2d'); if (!context) throw Error('瀏覽器未能處理圖片。');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      // Re-encoding strips original metadata. No network, localStorage, IndexedDB, or service worker.
      const normalized = canvas.toDataURL('image/png');
      if (normalized.length > 8 * 1024 * 1024) throw Error('處理後相片太大，請選擇較細嘅圖片。');
      if (version !== photoReadVersion) return;
      remember(); doc.photo = normalized; doc.photoX = 450; doc.photoY = 310; doc.photoScale = 100; doc.photoRotation = -6; selected = 'photo';
      photoUnsaved = true; $('photoStatus').textContent = '已加入本機相片。記得下載 PNG 保留作品。';
      changed('相片已加入，只喺本機處理。');
    } catch (error) { if (version === photoReadVersion) $('photoStatus').textContent = error.message + ' 原有作品未有改動。'; }
    finally { if (version === photoReadVersion) { photoBusy = false; render(); } }
  }
  async function saveAsImage() {
    if (exporting || photoBusy) return;
    exporting = true; render();
    try {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      const exportRevision = editVersion;
      const svg = buildSVG();
      svg.querySelectorAll('[data-editor-only]').forEach(el => el.remove());
      svg.querySelectorAll('[data-layer]').forEach(el => { el.removeAttribute('tabindex'); el.removeAttribute('role'); el.removeAttribute('data-layer'); });
      svg.setAttribute('width', '1800'); svg.setAttribute('height', '1360');
      const xml = new XMLSerializer().serializeToString(svg);
      const img = await new Promise((resolve, reject) => {
        const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(Error('未能產生圖片，請再試或使用較新版本瀏覽器。'));
        image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
      });
      const canvas = document.createElement('canvas'); canvas.width = 1800; canvas.height = 1360;
      const context = canvas.getContext('2d'); if (!context) throw Error('瀏覽器不支援 PNG 輸出。');
      context.drawImage(img, 0, 0); const png = canvas.toDataURL('image/png');
      if (!png.startsWith('data:image/png')) throw Error('未能製作 PNG，請再試。');
      const a = document.createElement('a'); a.href = png; a.download = 'bad-taste-design.png'; document.body.append(a); a.click(); a.remove();
      if (editVersion === exportRevision) {
        photoUnsaved = false; $('pngDownload').href = png; $('downloadReady').hidden = false;
      }
      say(editVersion === exportRevision ? 'PNG 已準備下載。手機如開啟圖片預覽，請長按儲存。' : '已輸出較早嘅版本；你啱啱再改過，請再下載最新作品。');
    } catch (error) { say(error.message || '下載失敗，作品仍然保留喺畫面，請再試。'); }
    finally { exporting = false; render(); }
  }
  async function shareDesign() {
    if (photoBusy) { say('相片仲處理緊，請稍等。'); return; }
    if (doc.photo) { say('相片只喺本機，連結無法完整還原。請下載 PNG 分享，唔會遺漏相片。'); return; }
    if (window.location.protocol === 'file:') { say('本機檔案連結其他人無法開啟。請下載 PNG，或喺網站版本複製連結。'); return; }
    const url = new URL(window.location.href); url.hash = B.encode(doc).slice(1);
    try { if (!navigator.clipboard || !navigator.clipboard.writeText) throw Error('Clipboard unavailable'); await navigator.clipboard.writeText(url.href); say('已複製完整作品連結。'); }
    catch { $('copyFallback').hidden = false; $('shareUrl').value = url.href; $('shareUrl').focus(); $('shareUrl').select(); say('瀏覽器未能自動複製，請用文字欄手動複製。'); }
  }
  // Build controls without interpolating user content into HTML.
  for (const [action, spec] of Object.entries(B.FEEDBACK)) {
    const button = document.createElement('button'); button.dataset.feedback = action; button.append(document.createTextNode(spec.label), document.createElement('span'));
    button.addEventListener('click', () => { const next = B.applyFeedback(doc, action); if (!next) return; remember(); doc = next; $('feedbackStatus').textContent = spec.report; changed(); });
    $('feedbackButtons').append(button);
  }
  for (const kind of B.STICKERS) {
    const button = document.createElement('button'); button.setAttribute('aria-label', '加入' + names[kind] + '貼紙');
    const icon = node('svg', { viewBox: '-70 -70 140 140', 'aria-hidden': 'true' }); icon.append(stickerArtwork(kind)); button.append(icon, document.createTextNode(names[kind]));
    button.addEventListener('click', () => {
      if (doc.stickers.length >= B.MAX_STICKERS) { say('最多 16 張貼紙，請先刪除一張。'); return; }
      change(() => { let id = 1; while (doc.stickers.some(s => s.id === id)) id++; doc.stickers.push({ id, kind, x: 120 + (doc.stickers.length * 133) % 660, y: 190 + (doc.stickers.length * 71) % 300, scale: 100, rotation: 0 }); selected = String(id); }, '已加入貼紙，可拖動或用數值調節。');
    }); $('stickerShelf').append(button);
  }
  for (const background of B.BACKGROUNDS) {
    const button = document.createElement('button'); button.dataset.background = background; button.setAttribute('aria-label', backgroundNames[background] + '背景');
    const label = document.createElement('span'); label.textContent = backgroundNames[background]; button.append(label);
    button.addEventListener('click', () => { if (doc.background !== background) change(() => { doc.background = background; }); }); $('backgrounds').append(button);
  }
  document.querySelectorAll('a[href^="#"]').forEach(link => link.addEventListener('click', e => {
    const target = document.getElementById(link.getAttribute('href').slice(1));
    if (target) { e.preventDefault(); target.scrollIntoView({ block: 'start' }); if (link.classList.contains('skip-link')) $('userText').focus({ preventScroll: true }); }
  }));
  $('generateButton').addEventListener('click', generate);
  $('userText').addEventListener('input', () => { $('charCount').textContent = [...$('userText').value].length; });
  $('userText').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); generate(); } });
  $('skipAnimation').addEventListener('click', finishSequence);
  $('sequenceDialog').addEventListener('cancel', e => { e.preventDefault(); finishSequence(); });
  $('downloadButton').addEventListener('click', saveAsImage); $('shareButton').addEventListener('click', shareDesign);
  $('closeCopy').addEventListener('click', () => { $('copyFallback').hidden = true; $('shareButton').focus(); });
  $('undoButton').addEventListener('click', () => { if (!history.length || photoBusy) return; doc = history.pop(); selected = ''; revision = Math.max(0, revision - 1); $('feedbackStatus').textContent = '已撤銷上一個改動。客戶表示：其實之前都幾好。'; changed('已撤銷。', true); });
  $('photoInput').addEventListener('change', e => { const file = e.target.files[0]; e.target.value = ''; loadPhoto(file); });
  $('removePhoto').addEventListener('click', () => { photoReadVersion++; photoBusy = false; change(() => { doc.photo = null; selected = ''; photoUnsaved = false; $('photoStatus').textContent = '相片已移除，可用撤銷還原。'; }); });
  $('selectPhoto').addEventListener('click', () => { select('photo', true); $('layerSelect').scrollIntoView({ block: 'nearest' }); });
  $('photoFilter').addEventListener('change', e => change(() => { doc.photoFilter = e.target.value; }));
  $('layerSelect').addEventListener('change', e => select(e.target.value));
  $('deleteSticker').addEventListener('click', () => { if (!selected || selected === 'photo') return; change(() => { doc.stickers = doc.stickers.filter(s => String(s.id) !== selected); selected = ''; }, '貼紙已刪除，可撤銷還原。'); });
  for (const key of ['x','y','scale','rotation']) {
    const field = $('object' + key[0].toUpperCase() + key.slice(1));
    const commit = e => {
    if (!currentObject()) return;
    const value = e.target.valueAsNumber;
    if (!Number.isFinite(value)) { renderSelection(); return; }
    const bounded = B.clamp(value, ...bounds(key));
    if (bounded !== currentObject()[key]) change(() => setObject(key, bounded)); else renderSelection();
    };
    field.addEventListener('change', commit); field.addEventListener('blur', commit);
  }
  for (const key of ['backgroundX', 'backgroundY', 'backgroundScale']) $(key).addEventListener('change', e => {
    const value = Number(e.target.value);
    if (!Number.isFinite(value) || e.target.value === '') { e.target.value = doc[key]; return; }
    const bounded = B.clamp(value, key === 'backgroundScale' ? 50 : -200, 200);
    if (bounded !== doc[key]) change(() => { doc[key] = bounded; });
  });
  $('backgroundScale').addEventListener('input', e => { $('backgroundScaleValue').textContent = e.target.value + '%'; });
  $('motionToggle').addEventListener('click', () => {
    if (reduced.matches) { say('已跟隨系統「減少動態」設定。'); return; }
    const on = document.body.classList.toggle('motion-on'); $('motionToggle').setAttribute('aria-pressed', String(on)); $('motionToggle').textContent = '動態：' + (on ? '開' : '關');
  });
  if (reduced.addEventListener) reduced.addEventListener('change', () => { if (reduced.matches) { document.body.classList.remove('motion-on'); $('motionToggle').setAttribute('aria-pressed', 'false'); $('motionToggle').textContent = '動態：關'; finishSequence(); } });
  const board = $('artboard');
  function point(event) { const box = $('generated').getBoundingClientRect(); return { x: (event.clientX - box.left) * 900 / box.width, y: (event.clientY - box.top) * 680 / box.height }; }
  board.addEventListener('pointerdown', e => {
    if (e.button !== 0 || exporting || photoBusy) return;
    const layer = e.target.closest('[data-layer]'); if (!layer) return;
    select(layer.dataset.layer); const obj = currentObject();
    if (!obj) return; e.preventDefault();
    const p = point(e); drag = { id: e.pointerId, start: p, x: obj.x, y: obj.y, before: snapshot(), moved: false, layer };
    board.setPointerCapture(e.pointerId); layer.focus({ preventScroll: true });
  });
  board.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const p = point(e); if (Math.abs(p.x - drag.start.x) + Math.abs(p.y - drag.start.y) < 2 && !drag.moved) return;
    drag.moved = true; setObject('x', Math.round(B.clamp(drag.x + p.x - drag.start.x, ...bounds('x')))); setObject('y', Math.round(B.clamp(drag.y + p.y - drag.start.y, ...bounds('y'))));
    const obj = currentObject(); drag.layer.setAttribute('transform', `translate(${obj.x} ${obj.y}) rotate(${obj.rotation}) scale(${obj.scale / 100})`); renderSelection();
  });
  function endDrag(e) { if (!drag || (e && e.pointerId !== drag.id)) return; const before = drag.before, moved = drag.moved, id = drag.id; drag = null; if (board.hasPointerCapture(id)) board.releasePointerCapture(id); if (moved) { remember(before); changed(); } }
  board.addEventListener('pointerup', endDrag); board.addEventListener('pointercancel', endDrag); board.addEventListener('lostpointercapture', endDrag);
  board.addEventListener('keydown', e => {
    const layer = e.target.closest('[data-layer]'); if (!layer) return;
    selected = layer.dataset.layer;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(selected, true); return; }
    if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) return;
    e.preventDefault(); const key = e.key.includes('Left') || e.key.includes('Right') ? 'x' : 'y';
    const amount = (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1) * (e.shiftKey ? 10 : 1);
    change(() => setObject(key, B.clamp(currentObject()[key] + amount, ...bounds(key))));
    $('artboard').querySelector(`[data-layer="${selected}"]`)?.focus({ preventScroll: true });
  });
  function loadHash() {
    try { const loaded = B.decode(window.location.hash); if (!loaded) return; if (doc.photo) { say('相片工作中未有載入其他連結，避免遺失。請先下載作品。'); syncURL(); return; } doc = loaded; editVersion++; history = []; selected = ''; revision = 0; render(true); }
    catch { say('連結格式無效或版本不支援，未有更改作品。'); }
  }
  window.addEventListener('hashchange', loadHash);
  window.addEventListener('beforeunload', e => { if (doc.photo && photoUnsaved) { e.preventDefault(); e.returnValue = ''; } });
  // Read-only integration hooks for regression tests and local inspection.
  window.BadTasteApp = { getDocument: () => snapshot(), serializeSVG: () => new XMLSerializer().serializeToString(buildSVG()), generate, shareDesign, saveAsImage };
  render(true); loadHash();
})();
