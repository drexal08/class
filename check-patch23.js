const fs = require('fs');
const content = fs.readFileSync('.open-next/server-functions/default/handler.mjs', 'utf8');

// Search for the actual dynamic import pattern more broadly
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('client-2c3a283f134fdcb6') || lines[i].includes('wasm-compiler-edge')) {
    console.log(`Line ${i + 1}: ${lines[i].substring(0, 300)}`);
  }
}