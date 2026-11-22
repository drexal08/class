const { readFileSync, writeFileSync, existsSync } = require('fs');
const { resolve } = require('path');

const workerdClassTsPath = resolve('src/generated/prisma-workerd/internal/class.ts');
if (!existsSync(workerdClassTsPath)) {
  console.log('File not found');
  process.exit(1);
}

let classTs = readFileSync(workerdClassTsPath, 'utf8');
const originalImport = 'import * as runtime from "@prisma/client/runtime/wasm-compiler-edge"';
const shimImport = 'import * as runtime from "@/lib/prisma-workerd-runtime"';

console.log('Before patch:');
console.log(classTs.substring(0, 200));

if (classTs.includes(originalImport)) {
  classTs = classTs.replace(originalImport, shimImport);
  writeFileSync(workerdClassTsPath, classTs);
  console.log('Patch applied');
} else {
  console.log('Original import not found');
  const lines = classTs.split('\n');
  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    if (lines[i].includes('@prisma/client/runtime/wasm-compiler-edge')) {
      console.log('Found at line', i + 1, ':', lines[i]);
    }
  }
}

console.log('After patch:');
console.log(classTs.substring(0, 200));