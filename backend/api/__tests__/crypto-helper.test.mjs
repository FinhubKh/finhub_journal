import { describe, it, expect } from 'vitest';
import { encryptSecret, decryptSecret, timingSafeTokenEqual } from '../crypto-helper.mjs';

const KEY = 'a'.repeat(64); // 32-byte hex key for tests

describe('encryptSecret / decryptSecret', () => {
  it('round-trips plaintext', () => {
    const ciphertext = encryptSecret('my-investor-password', KEY);
    expect(decryptSecret(ciphertext, KEY)).toBe('my-investor-password');
  });

  it('produces different ciphertext each time (random IV)', () => {
    const a = encryptSecret('same-input', KEY);
    const b = encryptSecret('same-input', KEY);
    expect(a).not.toBe(b);
  });

  it('throws when ciphertext is tampered with', () => {
    const ciphertext = encryptSecret('my-investor-password', KEY);
    const tampered = ciphertext.slice(0, -4) + 'abcd';
    expect(() => decryptSecret(tampered, KEY)).toThrow();
  });

  it('throws when the key is not 32 bytes', () => {
    expect(() => encryptSecret('x', 'tooshort')).toThrow();
  });

  it('throws when decrypted with the wrong key', () => {
    const ciphertext = encryptSecret('x', KEY);
    expect(() => decryptSecret(ciphertext, 'b'.repeat(64))).toThrow();
  });

  it('throws when plaintext is missing', () => {
    expect(() => encryptSecret(undefined, KEY)).toThrow();
    expect(() => encryptSecret(null, KEY)).toThrow();
    expect(() => encryptSecret('', KEY)).toThrow();
  });
});

describe('timingSafeTokenEqual', () => {
  it('returns true for matching tokens', () => {
    expect(timingSafeTokenEqual('secret-token', 'secret-token')).toBe(true);
  });

  it('returns false for non-matching tokens', () => {
    expect(timingSafeTokenEqual('secret-token', 'wrong-token')).toBe(false);
  });

  it('returns false for different-length tokens', () => {
    expect(timingSafeTokenEqual('short', 'much-longer-token')).toBe(false);
  });
});
