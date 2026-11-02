// Checks on issue pictures (ADR-0013). The type comes from the file's first bytes, not from
// the type the browser claims.

export const MAX_IMAGE_BYTES = 3_000_000;

/**
 * @param {Uint8Array} bytes
 * @returns {'image/jpeg'|'image/png'|'image/webp'|null} null when the bytes are not one of these
 */
export function sniffImage(bytes) {
  const b = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (b.length >= 12 && b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') {
    return 'image/webp';
  }
  return null;
}
