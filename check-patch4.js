const fs = require('fs');
const content = fs.readFileSync('.open-next/server-functions/default/handler.mjs', 'utf8');

// Search for the actual dynamic import pattern
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('e.y(') && lines[i].includes('wasm-compiler-edge')) {
    console.log(`Line ${i + 1}: ${lines[i].substring(0, 300)}`);
  }
}