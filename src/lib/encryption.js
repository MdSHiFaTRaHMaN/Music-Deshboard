import crypto from 'crypto';

// The secret key for encryption
// It must be 32 bytes for aes-256-cbc.
const getSecret = () => {
  const secret = process.env.JWT_SECRET || "super-secret-fallback-key-change-me";
  return crypto.scryptSync(secret, 'salt', 32);
};

const IV_LENGTH = 16;

/**
 * Encrypts a string (e.g. taskId) so it can be safely sent to the client.
 */
export function encryptTaskId(text) {
  if (!text) return text;
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', getSecret(), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  } catch (e) {
    console.error("Encryption error:", e);
    return text;
  }
}

/**
 * Decrypts a previously encrypted string.
 * If the string is already a UUID (unencrypted), returns it as-is for backward compatibility.
 */
export function decryptTaskId(text) {
  if (!text) return text;
  // Basic check if it's already a raw UUID (e.g. 2645c78d-a24e-4f3c-dc92-798e0711fdc4)
  if (text.includes('-') && text.length === 36) {
    return text;
  }
  
  try {
    const textParts = text.split(':');
    if (textParts.length !== 2) return text;
    
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', getSecret(), iv);
    
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (e) {
    console.error("Decryption error:", e);
    return text; // fallback to original text if decryption fails
  }
}
