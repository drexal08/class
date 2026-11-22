const fs = require('fs');
const content = fs.readFileSync('.open-next/server-functions/default/handler.mjs', 'utf8');
const regex = /e\.y\("@prisma\/client-2c3a283f134fdcb6\/runtime\/wasm-compiler-edge"\)/g;
const match = content.match(regex);
console.log('Matches:', match ? match.length : 0);
if (match) {
  console.log('First match:', match[0]);
}