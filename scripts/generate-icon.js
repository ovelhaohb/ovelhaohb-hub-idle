const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function generate() {
  const root = path.join(__dirname, '..');
  const png = await sharp(path.join(root, 'build', 'icon.svg')).resize(256, 256).png().toBuffer();

  // Um arquivo ICO pode carregar uma imagem PNG de 256 px diretamente.
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header.writeUInt8(0, 6);
  header.writeUInt8(0, 7);
  header.writeUInt8(0, 8);
  header.writeUInt8(0, 9);
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(22, 18);

  fs.writeFileSync(path.join(root, 'build', 'icon.ico'), Buffer.concat([header, png]));
}

generate().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
