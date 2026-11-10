const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const B = require('../engine.js');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const state = w => plain(w.BadTasteApp.getDocument());
const el = (w,id) => w.document.getElementById(id);
const change = (w,id,value) => { el(w,id).value = value; el(w,id).dispatchEvent(new w.Event('change', {bubbles:true})); };
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
function openApp(t, hash = '', configure = () => {}) {
  const errors = [], console = new VirtualConsole(); console.on('jsdomError', e => errors.push(e.message));
  // No resource loader: only the repository's exact local scripts run, never URLs from test payloads.
  const dom = new JSDOM(read('index.html'), {url:'https://example.test/'+hash, runScripts:'outside-only', virtualConsole:console});
  const w = dom.window; w.__xssHits = []; w.__copied = [];
  w.Element.prototype.scrollIntoView = () => {};
  w.matchMedia = () => ({matches:true, addEventListener(){}});
  Object.defineProperty(w.navigator, 'clipboard', {configurable:true,value:{writeText: async text => w.__copied.push(text)}});
  configure(w); w.eval(read('engine.js')); w.eval(read('app.js'));
  t.after(() => { w.close(); assert.deepEqual(errors, [], 'no uncaught application errors'); });
  return w;
}
function safe(w, raw) {
  const svg = el(w,'generated'); assert.equal(state(w).text, raw); assert.equal(el(w,'userText').value, raw);
  assert.ok([...svg.querySelectorAll('title')].some(n => n.textContent === raw));
  assert.equal(svg.querySelectorAll('script,foreignObject,iframe,style,a,image').length, 0);
  assert.deepEqual([...svg.querySelectorAll('*')].flatMap(n => [...n.attributes].filter(a => /^on/i.test(a.name))), []);
  assert.equal(w.document.querySelectorAll('#generated').length, 1);
  assert.deepEqual([...w.__xssHits], []);
  const xml = new w.DOMParser().parseFromString(w.BadTasteApp.serializeSVG(), 'image/svg+xml');
  assert.equal(xml.querySelector('parsererror'), null); assert.equal(xml.querySelector('script,foreignObject,iframe'), null);
}
const payloads = {
  image:'<img src=x onerror="window.__xssHits.push(1)">', svg:'<svg/onload=window.__xssHits.push(2)>',
  breakout:'</span></div><img src=x onerror="window.__xssHits.push(3)">', mixedCase:'<ImG sRc=x oNeRrOr="window.__xssHits.push(4)">',
  srcdoc:'<iframe srcdoc="<svg onload=parent.__xssHits.push(5)>"></iframe>', entities:'&lt;img src=x onerror=window.__xssHits.push(6)&gt; &#60;svg&#62;',
  encoded:'%3Cimg%20src=x%20onerror=window.__xssHits.push(7)%3E', markup:'<style>body{display:none}</style><a href="javascript:window.__xssHits.push(8)">click</a>'
};
for (const [name, payload] of Object.entries(payloads)) {
  test(`literal XSS protection: ${name}, old hash, v2 link, manual input and SVG serialization`, t => {
    const w = openApp(t, '#'+encodeURIComponent(payload)); safe(w,payload);
    safe(openApp(t,B.encode(state(w))),payload);
    const manual = openApp(t); el(manual,'userText').value = payload; el(manual,'generateButton').click(); safe(manual,payload);
    assert.deepEqual(B.decode(manual.location.hash),state(manual));
  });
}

test('feedback is isolated, undo restores exact model, report updates and controls saturate', t => {
  const w = openApp(t);
  for (const [action,spec] of Object.entries(B.FEEDBACK)) {
    const before = state(w), button = w.document.querySelector(`[data-feedback="${action}"]`); button.click();
    assert.deepEqual(state(w),B.applyFeedback(before,action)); assert.equal(+el(w,'badnessScore').textContent,B.report(state(w)).score);
    assert.deepEqual([...el(w,'reportDetails').children].map(n=>n.textContent),B.report(state(w)).details);
    el(w,'undoButton').click(); assert.deepEqual(state(w),before);
    for (let i=before.effects[spec.key];i<spec.max;i++) button.click();
    assert.equal(button.disabled,true); const max = state(w); button.click(); assert.deepEqual(state(w),max);
  }
});

test('stickers add, clamp transforms, delete and undo; background state survives exact share/reload', async t => {
  const w = openApp(t); const before = state(w); el(w,'stickerShelf').children[3].click();
  const id = state(w).stickers.at(-1).id; assert.equal(state(w).stickers.length,before.stickers.length+1);
  change(w,'objectX','999999'); change(w,'objectY','-999'); change(w,'objectScale','999'); change(w,'objectRotation','-999');
  assert.deepEqual(state(w).stickers.at(-1),{id,kind:'disk',x:835,y:65,scale:170,rotation:-180});
  const transformed=state(w); change(w,'objectX',''); assert.deepEqual(state(w),transformed);
  el(w,'deleteSticker').click(); assert.equal(state(w).stickers.length,before.stickers.length); el(w,'undoButton').click(); assert.deepEqual(state(w),transformed);
  w.document.querySelector('[data-background="grid"]').click(); change(w,'backgroundX','99999'); change(w,'backgroundY','-99999'); change(w,'backgroundScale','170');
  assert.equal(state(w).backgroundX,200); assert.equal(state(w).backgroundY,-200); assert.equal(state(w).backgroundScale,170);
  await w.BadTasteApp.shareDesign(); const link=w.__copied.at(-1); assert.deepEqual(state(openApp(t,new URL(link).hash)),state(w));
  while(state(w).stickers.length<16) el(w,'stickerShelf').children[0].click(); const full=state(w); el(w,'stickerShelf').children[0].click(); assert.deepEqual(state(w),full);
});

test('malformed/oversized hashes preserve state; empty and huge input cannot replace artwork', t => {
  const w = openApp(t), before=state(w);
  for (const hash of ['#%E0%A4%A','#bt2=null','#bt2='+encodeURIComponent(JSON.stringify({...before,photo:'https://evil.test/p'})),'#'+ 'a'.repeat(24001)]) {
    w.history.replaceState(null,'',hash); w.dispatchEvent(new w.HashChangeEvent('hashchange')); assert.deepEqual(state(w),before);
  }
  for(const text of ['   ','x'.repeat(501),'a\u0000b','\ud800']) {el(w,'userText').value=text; el(w,'generateButton').click(); assert.deepEqual(state(w),before);}
  el(w,'userText').value=''; el(w,'generateButton').click(); assert.equal(w.document.activeElement,el(w,'userText'));
});

test('keyboard selection/movement retains focus and supports undo', t => {
  const w=openApp(t), before=state(w); let layer=w.document.querySelector('[data-layer="1"]'); layer.focus();
  layer.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',shiftKey:true,bubbles:true}));
  assert.equal(state(w).stickers[0].x,before.stickers[0].x+10); assert.equal(w.document.activeElement.dataset.layer,'1');
  w.document.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true})); assert.equal(w.document.activeElement,el(w,'layerSelect'));
  el(w,'undoButton').click(); assert.deepEqual(state(w),before);
});

test('generation sequence prevents duplicates, skip and Escape finish once, generation focus is useful', t => {
  const w=openApp(t,'',w=>{w.matchMedia=()=>({matches:false,addEventListener(){}}); w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};});
  const before=state(w); el(w,'userText').value='First'; el(w,'generateButton').click(); el(w,'generateButton').click(); assert.deepEqual(state(w),before); assert.equal(w.document.activeElement,el(w,'skipAnimation'));
  el(w,'skipAnimation').click(); el(w,'skipAnimation').click(); assert.equal(state(w).text,'First'); assert.equal(el(w,'revisionCount').textContent,'1 次'); assert.equal(w.document.activeElement,el(w,'downloadButton'));
  el(w,'userText').value='Second'; el(w,'generateButton').click(); el(w,'sequenceDialog').dispatchEvent(new w.Event('cancel',{cancelable:true})); assert.equal(state(w).text,'Second');
  el(w,'skipSequence').checked=true; el(w,'userText').value='Third'; el(w,'userText').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',ctrlKey:true})); assert.equal(state(w).text,'Third'); assert.equal(el(w,'sequenceDialog').open,false);
});

test('clipboard fallback gives selectable exact link and returns focus on close', async t => {
  const w=openApp(t); Object.defineProperty(w.navigator,'clipboard',{value:undefined}); await w.BadTasteApp.shareDesign();
  assert.equal(el(w,'copyFallback').hidden,false); assert.equal(w.document.activeElement,el(w,'shareUrl')); assert.deepEqual(B.decode(new URL(el(w,'shareUrl').value).hash),state(w));
  el(w,'closeCopy').click(); assert.equal(el(w,'copyFallback').hidden,true); assert.equal(w.document.activeElement,el(w,'shareButton'));
});

test('internal navigation does not replace artwork or clear undo', async t => {
  const w=openApp(t); w.document.querySelector('[data-feedback="bigger"]').click(); const before=state(w);
  for(const hash of ['#studio','#feedback','#report']) {w.document.querySelector(`a[href="${hash}"]`).click();await tick();assert.deepEqual(state(w),before);}
  assert.equal(el(w,'undoButton').disabled,false);
});

test('local photo is normalized, never shared in a URL, retained through generation and undo', async t => {
  const w=openApp(t,'',w=>{
    w.FileReader=class {readAsDataURL(){this.result='data:image/jpeg;base64,ORIGINAL_METADATA';queueMicrotask(()=>this.onload());}};
    w.Image=class {constructor(){this.naturalWidth=640;this.naturalHeight=480;}set src(value){queueMicrotask(()=>this.onload());}};
    w.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){}}); w.HTMLCanvasElement.prototype.toDataURL=()=> 'data:image/png;base64,NORMALIZED';
    w.fetch=()=>{throw Error('Network forbidden');}; w.XMLHttpRequest=class {constructor(){throw Error('Network forbidden');}};
  });
  el(w,'generateButton').click(); const old=state(w);
  Object.defineProperty(el(w,'photoInput'),'files',{configurable:true,value:[{type:'image/jpeg',size:100}]}); el(w,'photoInput').dispatchEvent(new w.Event('change')); await tick();
  assert.equal(state(w).photo,'data:image/png;base64,NORMALIZED'); assert.equal(w.location.hash,''); assert.equal(el(w,'shareButton').getAttribute('aria-disabled'),'true');
  await w.BadTasteApp.shareDesign(); assert.deepEqual(w.__copied,[]); assert.match(el(w,'status').textContent,/PNG/);
  el(w,'userText').value='with photo'; el(w,'generateButton').click(); assert.equal(state(w).photo,'data:image/png;base64,NORMALIZED');
  el(w,'removePhoto').click(); assert.equal(state(w).photo,null); assert.ok(w.location.hash.startsWith('#bt2=')); el(w,'undoButton').click(); assert.equal(state(w).photo,'data:image/png;base64,NORMALIZED'); assert.equal(w.location.hash,'');
  const current=state(w); Object.defineProperty(el(w,'photoInput'),'files',{value:[{type:'image/svg+xml',size:100}]});el(w,'photoInput').dispatchEvent(new w.Event('change'));await tick();assert.deepEqual(state(w),current);assert.match(el(w,'photoStatus').textContent,/JPG/);
  assert.equal(old.photo,null);
});

test('valid maximum sticker IDs remain editable and shareable after adding', t => {
  const d=B.newDocument('max id',1);d.stickers[0].id=1000000;
  const w=openApp(t,B.encode(d));el(w,'stickerShelf').children[0].click();
  const current=state(w);assert.equal(current.stickers.length,4);assert.equal(new Set(current.stickers.map(s=>s.id)).size,4);
  assert.deepEqual(B.decode(B.encode(current)),current);assert.deepEqual(B.decode(w.location.hash),current);
});

test('inspection snapshots cannot mutate live model', t => {
  const w=openApp(t),before=state(w),copy=w.BadTasteApp.getDocument();copy.text='mutated';copy.effects.size=3;copy.stickers[0].x=700;
  assert.deepEqual(state(w),before);
});

test('PNG export uses current SVG at 1800 × 1360 and strips editing overlays', async t => {
  const captures={sources:[],downloads:[],draws:[]};
  const w=openApp(t,'',w=>{
    w.Image=class {set src(value){captures.sources.push(value);queueMicrotask(()=>this.onload());}};
    w.HTMLCanvasElement.prototype.getContext=function(){const canvas=this;return {drawImage(...args){captures.draws.push({width:canvas.width,height:canvas.height,args:args.length});}};};
    w.HTMLCanvasElement.prototype.toDataURL=()=> 'data:image/png;base64,STUB';
    w.HTMLAnchorElement.prototype.click=function(){captures.downloads.push({href:this.href,name:this.download});};
  });
  w.document.querySelector('[data-feedback="premium"]').click();const before=state(w);
  await w.BadTasteApp.saveAsImage();assert.deepEqual(state(w),before);
  assert.deepEqual(captures.downloads,[{href:'data:image/png;base64,STUB',name:'bad-taste-design.png'}]);assert.deepEqual(captures.draws,[{width:1800,height:1360,args:3}]);
  const xml=decodeURIComponent(captures.sources[0].split(',').slice(1).join(','));const svg=new w.DOMParser().parseFromString(xml,'image/svg+xml');
  assert.equal(svg.documentElement.getAttribute('width'),'1800');assert.equal(svg.documentElement.getAttribute('height'),'1360');
  assert.equal(svg.querySelector('[data-editor-only],[data-layer],[tabindex]'),null);assert.ok([...svg.querySelectorAll('title')].some(n=>n.textContent===before.text));
  assert.equal(el(w,'downloadButton').disabled,false);
});

function selectFile(w,file) {
  Object.defineProperty(el(w,'photoInput'),'files',{configurable:true,value:[file]});
  el(w,'photoInput').dispatchEvent(new w.Event('change'));
  assert.equal(el(w,'photoInput').value,'','input reset permits selecting the same file again');
}
function deferredPhotoApp(t) {
  const pending=[], controls={width:640,height:480,normalized:'data:image/png;base64,NORMALIZED'};
  const w=openApp(t,'',w=>{
    w.FileReader=class {readAsDataURL(file){this.result='data:'+file.type+';base64,LOCAL';queueMicrotask(()=>this.onload());}};
    w.Image=class {constructor(){this.naturalWidth=controls.width;this.naturalHeight=controls.height;}set src(value){this.source=value;pending.push(this);}};
    w.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){}});
    w.HTMLCanvasElement.prototype.toDataURL=()=>controls.normalized;
    w.HTMLAnchorElement.prototype.click=function(){};
  });
  return {w,pending,controls};
}

test('invalid second photo selection cannot strand a pending valid decode or disable download forever', async t => {
  const {w,pending}=deferredPhotoApp(t);
  selectFile(w,{type:'image/png',size:100});await tick();assert.equal(el(w,'downloadButton').disabled,true);
  selectFile(w,{type:'image/svg+xml',size:100});pending[0].onload();await tick();
  assert.equal(el(w,'downloadButton').disabled,false);assert.equal(el(w,'undoButton').disabled,false);
  assert.equal(state(w).photo,'data:image/png;base64,NORMALIZED');
});

test('same photo can be selected repeatedly; later valid choice wins out-of-order decode', async t => {
  const {w,pending,controls}=deferredPhotoApp(t),file={type:'image/jpeg',size:100};
  selectFile(w,file);await tick();pending[0].onload();await tick();assert.equal(state(w).photo,controls.normalized);
  selectFile(w,file);await tick();assert.equal(pending.length,2);pending[1].onload();await tick();assert.equal(el(w,'downloadButton').disabled,false);
  selectFile(w,file);await tick();selectFile(w,{type:'image/webp',size:200});await tick();
  controls.normalized='data:image/png;base64,NEWEST';pending[3].onload();await tick();
  controls.normalized='data:image/png;base64,STALE';pending[2].onload();await tick();
  assert.equal(state(w).photo,'data:image/png;base64,NEWEST');assert.equal(el(w,'downloadButton').disabled,false);
});

test('invalid type, empty/oversized file, corrupt raster, huge dimensions and output preserve existing photo', async t => {
  const {w,pending,controls}=deferredPhotoApp(t);
  selectFile(w,{type:'image/jpeg',size:100});await tick();pending[0].onload();await tick();const before=state(w);
  for(const file of [{type:'image/svg+xml',size:100},{type:'image/jpeg',size:0},{type:'image/png',size:10*1024*1024+1}]) {
    selectFile(w,file);await tick();assert.deepEqual(state(w),before);assert.equal(el(w,'downloadButton').disabled,false);
  }
  selectFile(w,{type:'image/png',size:100});await tick();pending.at(-1).onerror();await tick();assert.deepEqual(state(w),before);assert.match(el(w,'photoStatus').textContent,/損壞/);assert.equal(el(w,'downloadButton').disabled,false);
  controls.width=8000;controls.height=8000;selectFile(w,{type:'image/png',size:100});await tick();pending.at(-1).onload();await tick();assert.deepEqual(state(w),before);assert.match(el(w,'photoStatus').textContent,/3200/);
  controls.width=100;controls.height=100;controls.normalized='data:image/png;base64,'+'x'.repeat(8*1024*1024);selectFile(w,{type:'image/png',size:100});await tick();pending.at(-1).onload();await tick();assert.deepEqual(state(w),before);assert.match(el(w,'photoStatus').textContent,/太大/);assert.equal(el(w,'downloadButton').disabled,false);
});

test('export is single-flight and a concurrent edit keeps latest photo marked unsaved', async t => {
  const {w,pending}=deferredPhotoApp(t);
  selectFile(w,{type:'image/png',size:100});await tick();pending[0].onload();await tick();
  const exporting=w.BadTasteApp.saveAsImage();assert.equal(pending.length,2);assert.equal(el(w,'downloadButton').disabled,true);
  await w.BadTasteApp.saveAsImage();assert.equal(pending.length,2,'repeat export must not create another raster job');
  w.document.querySelector('[data-feedback="bigger"]').click();pending[1].onload();await exporting;
  assert.equal(el(w,'downloadButton').disabled,false);assert.equal(el(w,'downloadReady').hidden,true);assert.match(el(w,'status').textContent,/較早/);
  const unloading=new w.Event('beforeunload',{cancelable:true});w.dispatchEvent(unloading);assert.equal(unloading.defaultPrevented,true,'new edits still need download');
  const latest=w.BadTasteApp.saveAsImage();pending[2].onload();await latest;
  assert.equal(el(w,'downloadReady').hidden,false);const saved=new w.Event('beforeunload',{cancelable:true});w.dispatchEvent(saved);assert.equal(saved.defaultPrevented,false);
});

test('loading another shared design during export never offers stale PNG as current', async t => {
  const {w,pending}=deferredPhotoApp(t);const exporting=w.BadTasteApp.saveAsImage();
  const next=B.newDocument('Different linked design',987);w.history.replaceState(null,'',B.encode(next));w.dispatchEvent(new w.HashChangeEvent('hashchange'));assert.deepEqual(state(w),next);
  pending[0].onload();await exporting;
  assert.equal(el(w,'downloadReady').hidden,true);assert.match(el(w,'status').textContent,/較早/);
});
