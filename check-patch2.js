const fs = require('fs');
const content = fs.readFileSync('.open-next/server-functions/default/handler.mjs', 'utf8');
const regex = /e\.y\("@prisma\/client-2c3a283f134fdcb6\/runtime\/wasm-compiler-edge"\)/g;
const match = content.match(regex);
console.log('Matches:', match ? match.length : 0);
if (match) {
  console.log('First match:', match[0]);
}

// Also check for the patched version
const patchedRegex = /e\.y\("@prisma\/client\/runtime\/wasm-compiler-edge"\)/g;
const patchedMatch = content.match(patchedRegex);
console.log('Patched matches:', patchedMatch ? patchedMatch.length : 0);