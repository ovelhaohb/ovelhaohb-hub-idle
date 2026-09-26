const test = require('node:test');
const assert = require('node:assert/strict');
const { encryptBackup, decryptBackup } = require('../src/lib/portable-backup');

test('backup criptografado restaura o conteúdo com a senha correta', () => {
  const payload = { format: 2, games: [{ name: 'Teste', username: 'ovelha', password: 'segredo' }] };
  const encrypted = encryptBackup(payload, 'senha-segura');
  assert.equal(encrypted.encrypted, true);
  assert.equal(JSON.stringify(encrypted).includes('segredo'), false);
  assert.deepEqual(decryptBackup(encrypted, 'senha-segura'), payload);
});

test('backup criptografado rejeita senha incorreta', () => {
  const encrypted = encryptBackup({ format: 2 }, 'senha-correta');
  assert.throws(() => decryptBackup(encrypted, 'senha-errada'), /Senha incorreta/);
});

test('senha de backup exige pelo menos oito caracteres', () => {
  assert.throws(() => encryptBackup({}, 'curta'), /8 caracteres/);
});
