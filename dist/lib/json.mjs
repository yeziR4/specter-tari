// Preserve large JSON integers as decimal strings. Raw archives remain byte-for-byte intact.
export function parseLossless(text) {
  if (typeof text !== 'string' || text.length > 5_000_000) throw Error('JSON input must be text under 5 MB.');
  const normalized = text.replace(/"(?:[^"\\\u0000-\u001f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/g, token => {
    if (token.startsWith('"')) return token;
    if (/^-?\d+$/.test(token) && !Number.isSafeInteger(Number(token))) return JSON.stringify(token);
    return token;
  });
  // Also validate original grammar; malformed numeric tokens cannot be repaired by normalization.
  JSON.parse(text);
  return JSON.parse(normalized);
}
