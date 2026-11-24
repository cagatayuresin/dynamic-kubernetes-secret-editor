export type DecodeResult =
  | { status: 'text'; text: string }
  | { status: 'binary' }
  | { status: 'invalid' };

export function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}

export function decodeBase64(value: string): DecodeResult {
  const compact = value.replace(/\s+/g, '');
  if (compact === '') {
    return { status: 'text', text: '' };
  }

  let binary: string;
  try {
    binary = atob(compact);
  } catch {
    return { status: 'invalid' };
  }

  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return { status: 'text', text };
  } catch {
    return { status: 'binary' };
  }
}
