const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
fs.mkdirSync(path.join(root, 'dist'), {recursive:true});
for (const file of ['index.html', 'style.css', 'engine.js', 'app.js']) fs.copyFileSync(path.join(root, file), path.join(root, 'dist', file));
console.log('Static build ready in dist/');
