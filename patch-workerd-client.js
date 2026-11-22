const { readFileSync, writeFileSync, existsSync } = require('fs');
const { resolve } = require('path');

const workerdClientTsPath = resolve('src/generated/prisma-workerd/client.ts');
if (!existsSync(workerdClientTsPath)) {
  console.log('File not found');
  process.exit(1);
}

let clientTs = readFileSync(workerdClientTsPath, 'utf8');
const originalImport = 'import * as runtime from "@prisma/client/runtime/wasm-compiler-edge"';
const shimImport = 'import * as runtime from "@/lib/prisma-workerd-runtime"';

console.log('Before patch:');
console.log(clientTs.substring(0, 200));

if (clientTs.includes(originalImport)) {
  clientTs = clientTs.replace(originalImport, shimImport);
  writeFileSync(workerdClientTsPath, clientTs);
  console.log('Patch applied');
} else {
  console.log('Original import not found');
  console.log('Looking for:', originalImport);
  // Find the actual import line
  const lines = clientTs.split('\n');
  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    if (lines[i].includes('@prisma/client/runtime/wasm-compiler-edge')) {
      console.log('Found at line', i + 1, ':', lines[i]);
    }
  }
}

console.log('After patch:');
console.log(clientTs.substring(0, 200));