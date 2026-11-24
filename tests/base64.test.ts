import { describe, expect, it } from 'vitest';
import { decodeBase64, encodeBase64 } from '../src/lib/base64';

describe('base64', () => {
  it('round-trips utf-8 text, including Turkish characters and newlines', () => {
    for (const value of ['', 'hello', 'çağatay', 'İstanbul', 'merhaba dünya', 'line1\nline2', '🔐']) {
      const encoded = encodeBase64(value);
      expect(decodeBase64(encoded)).toEqual({ status: 'text', text: value });
    }
    expect(encodeBase64('hello')).toBe('aGVsbG8=');
  });

  it('ignores whitespace and rejects invalid or binary payloads', () => {
    expect(decodeBase64('   ')).toEqual({ status: 'text', text: '' });
    expect(decodeBase64('aGVs bG8=')).toEqual({ status: 'text', text: 'hello' });
    expect(decodeBase64('%%%')).toEqual({ status: 'invalid' });
    expect(decodeBase64('/w==')).toEqual({ status: 'binary' });
  });
});
