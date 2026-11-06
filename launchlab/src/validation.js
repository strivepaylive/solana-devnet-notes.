// Pure validation functions; no secret keys or network requests.
export const DEVNET_USDC = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
export const QUOTES = Object.freeze({
  SOL: { decimals: 9, label: 'SOL' },
  USDC: { decimals: 6, label: 'USDC (devnet)' }
});
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function isPublicKey(value) {
  return typeof value === 'string' && BASE58.test(value);
}
export function safeMetadataUrl(value) {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol !== 'https:' || url.username || url.password) return false;
    if (!url.hostname.includes('.') || /^(localhost|127\.|10\.|192\.168\.)/.test(url.hostname)) return false;
    return value.length <= 350;
  } catch {
    return false;
  }
}
export function validateLaunch(value) {
  const errors = [];
  const name = String(value.name || '').trim();
  const symbol = String(value.symbol || '').trim().toUpperCase();
  const quote = String(value.quote || '');
  if (name.length < 2 || name.length > 32) errors.push('Token name must contain 2–32 characters.');
  if (!/^[A-Z0-9]{2,10}$/.test(symbol)) errors.push('Ticker must be 2–10 letters or numbers.');
  if (!safeMetadataUrl(value.metadataUrl)) errors.push('Provide an HTTPS token metadata JSON URL.');
  if (!Object.hasOwn(QUOTES, quote)) errors.push('Choose SOL or USDC.');
  if (value.configId && !isPublicKey(value.configId)) errors.push('Configuration address is not a valid Solana public key.');
  return { ok: errors.length === 0, errors, name, symbol, quote, metadataUrl: String(value.metadataUrl || '').trim() };
}

// Exact decimal parsing. Never use binary floating-point for token units.
export function toAtomic(value, decimals) {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 12) throw Error('Invalid asset precision.');
  const text = String(value || '').trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(text)) throw Error('Enter a positive decimal amount.');
  const [whole, fraction = ''] = text.split('.');
  if (fraction.length > decimals) throw Error('Too many decimal places for this asset.');
  const units = BigInt(whole) * (10n ** BigInt(decimals)) + BigInt(fraction.padEnd(decimals, '0') || '0');
  if (units <= 0n || units > 18446744073709551615n) throw Error('Amount must be positive and fit within a Solana token u64.');
  return units.toString();
}

export function requireDevnetNetwork(endpoint) {
  const url = new URL(endpoint);
  // This is a local safety guard, not a substitute for program/transaction verification.
  if (url.protocol !== 'https:' || url.hostname !== 'api.devnet.solana.com') {
    throw Error('This app permits only the official Solana devnet RPC.');
  }
  return true;
}
