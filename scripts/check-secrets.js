const { execFileSync } = require('child_process');

const scanAllTrackedFiles = process.argv.includes('--all');
const sensitivePathPatterns = [
  /(^|\/)\.env(?:\..*)?$/i,
  /(^|\/)(?:artifacts|backups)(\/|$)/i,
  /^(?:games|settings|analytics|game-notes|game-companion|reminders|cache-maintenance)\.json$/i,
  /(^|\/)(?:id_rsa|credentials|secrets?|tokens?|passwords?)(?:\.|$)/i,
  /\.(?:pem|key|pfx|p12)$/i
];

const secretPatterns = [
  { label: 'chave privada', pattern: /-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----/ },
  { label: 'token GitHub', pattern: /(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})/ },
  { label: 'chave AWS', pattern: /AKIA[0-9A-Z]{16}/ },
  { label: 'token Slack', pattern: /xox[baprs]-[A-Za-z0-9-]{10,}/ },
  { label: 'chave Google', pattern: /AIza[0-9A-Za-z_-]{20,}/ },
  { label: 'chave OpenAI', pattern: /sk-[A-Za-z0-9_-]{20,}/ },
  { label: 'webhook Discord', pattern: /https:\/\/discord(?:app)?\.com\/api\/webhooks\/[0-9]+\/[A-Za-z0-9_-]+/i },
  { label: 'senha em texto', pattern: /(?:password|passwd|client_secret|api_key)\s*[:=]\s*["'][A-Za-z0-9!@%^&*._-]{8,}["']/i }
];

function git(args, encoding = 'utf8') {
  return execFileSync('git', args, { encoding, stdio: ['ignore', 'pipe', 'ignore'] });
}

function filesToScan() {
  const args = scanAllTrackedFiles
    ? ['ls-files', '-z']
    : ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'];
  return git(args, 'buffer').toString('utf8').split('\0').filter(Boolean);
}

function readFileFromIndex(file) {
  return git(['show', `:${file}`]);
}

const findings = [];
for (const file of filesToScan()) {
  if (sensitivePathPatterns.some((pattern) => pattern.test(file))) {
    findings.push(`${file}: arquivo local ou sensível não pode ser versionado`);
    continue;
  }

  let content;
  try { content = readFileFromIndex(file); } catch { continue; }
  if (content.includes('\0')) continue;
  for (const { label, pattern } of secretPatterns) {
    if (pattern.test(content)) findings.push(`${file}: possível ${label}`);
  }
}

if (findings.length) {
  console.error('Commit bloqueado pela proteção de dados:');
  for (const finding of findings) console.error(`- ${finding}`);
  console.error('Remova o dado do índice e guarde-o fora do repositório.');
  process.exit(1);
}

console.log(scanAllTrackedFiles
  ? 'Nenhum dado sensível foi encontrado nos arquivos rastreados.'
  : 'Nenhum dado sensível foi encontrado nos arquivos preparados para commit.');
