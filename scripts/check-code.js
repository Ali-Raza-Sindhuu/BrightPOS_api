#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(target);
    else if (/\.(js|cjs)$/.test(entry.name)) files.push(target);
  }
}
for (const folder of ['src', 'database/seeds', 'scripts', 'tests']) walk(path.join(root, folder));
files.push(path.join(root, 'server.js'));
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  new vm.Script(source, { filename: file });
  const active = source.split('\n').filter(line => !/^\s*\/\//.test(line)).join('\n');
  for (const match of active.matchAll(/require\((['"])(\.[^'"]+)\1\)/g)) {
    const target = require.resolve(path.resolve(path.dirname(file), match[2]));
    let current = root;
    for (const segment of path.relative(root, target).split(path.sep)) {
      if (!fs.readdirSync(current).includes(segment)) throw new Error(`Import casing mismatch in ${path.relative(root, file)}: ${match[2]}`);
      current = path.join(current, segment);
    }
  }
}
console.log(`[code] ${files.length} JavaScript files parsed; relative imports exist with exact casing.`);
