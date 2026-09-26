const { spawnSync } = require('child_process');
const path = require('path');

const files = [
  'src/main.js',
  'src/preload.js',
  'src/renderer/app.js',
  'src/lib/portable-backup.js',
  'scripts/start.js'
];

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', path.resolve(file)], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log(`Sintaxe validada em ${files.length} arquivos.`);
