const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';

function deriveKey(password, salt) {
  if (typeof password !== 'string' || password.length < 8) {
    throw new Error('Use uma senha de backup com pelo menos 8 caracteres.');
  }
  return crypto.scryptSync(password, salt, 32);
}

function encryptBackup(payload, password) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, deriveKey(password, salt), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  return {
    format: 2,
    encrypted: true,
    algorithm: ALGORITHM,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: encrypted.toString('base64')
  };
}

function decryptBackup(envelope, password) {
  if (!envelope || envelope.format !== 2 || envelope.encrypted !== true || envelope.algorithm !== ALGORITHM) {
    throw new Error('Formato de backup criptografado inválido.');
  }
  try {
    const salt = Buffer.from(envelope.salt, 'base64');
    const iv = Buffer.from(envelope.iv, 'base64');
    const decipher = crypto.createDecipheriv(ALGORITHM, deriveKey(password, salt), iv);
    decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
    const clear = Buffer.concat([decipher.update(Buffer.from(envelope.data, 'base64')), decipher.final()]);
    return JSON.parse(clear.toString('utf8'));
  } catch (error) {
    if (error.message?.includes('pelo menos 8')) throw error;
    throw new Error('Senha incorreta ou backup danificado.');
  }
}

module.exports = { encryptBackup, decryptBackup };
