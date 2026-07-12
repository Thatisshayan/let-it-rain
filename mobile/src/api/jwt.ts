const BASE64URL_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function base64UrlDecode(input: string): string {
  let bits = "";
  for (const char of input) {
    const index = BASE64URL_CHARS.indexOf(char);
    if (index === -1) continue;
    bits += index.toString(2).padStart(6, "0");
  }

  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }

  return bytes.map((b) => String.fromCharCode(b)).join("");
}

function utf8Decode(binaryString: string): string {
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new TextDecoder("utf-8").decode(bytes);
}

// Matches the API's SessionPayload (src/lib/auth.ts) — note `userId`, not `id`.
type DecodedToken = {
  userId: string;
  email: string;
  name: string;
  permissions: string[];
  tokenVersion?: number;
  exp?: number;
};

/**
 * Decodes a JWT's payload WITHOUT verifying its signature — safe only for
 * optimistic client-side UI state (e.g. "who am I, should I show the login
 * screen"). Every actual API call still carries the raw token and is
 * independently verified server-side; a forged/expired token here just
 * results in the first real request failing with 401, which signOut()s.
 */
export function decodeJwtPayload(token: string): DecodedToken | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const json = utf8Decode(base64UrlDecode(parts[1]));
    return JSON.parse(json) as DecodedToken;
  } catch {
    return null;
  }
}

export function isTokenExpired(payload: DecodedToken): boolean {
  if (!payload.exp) return false;
  return Date.now() >= payload.exp * 1000;
}
