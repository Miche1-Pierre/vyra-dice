/** Crockford base32: digits and capitals without I, L, O, U, easy to read out on the phone. */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
const SUFFIX_LENGTH = 5
const PREFIX_PATTERN = /^[A-Z]{3}$/
const REQUEST_ID_PATTERN = /^([A-Z]{3})-([0-9A-HJKMNP-TV-Z]{5})$/

/**
 * Short request id given to the buyer and the club, e.g. `DEM-7K2QF`.
 *
 * 32^5 ≈ 33.5 M combinations: collisions are rare but possible, so a persistent store must keep
 * ids unique (unique constraint + retry).
 */
export function createRequestId(prefix: string): string {
  if (!PREFIX_PATTERN.test(prefix)) {
    throw new RangeError(`Request id prefix must be three uppercase letters, got "${prefix}"`)
  }
  const bytes = crypto.getRandomValues(new Uint8Array(SUFFIX_LENGTH))
  let suffix = ""
  // 256 is a multiple of 32, so masking the low 5 bits keeps every character equally likely.
  for (const byte of bytes) suffix += ALPHABET[byte & 31]
  return `${prefix}-${suffix}`
}

/** Whether `value` is a request id, optionally with the given club prefix. */
export function isRequestId(value: string, prefix?: string): boolean {
  const match = REQUEST_ID_PATTERN.exec(value)
  return match !== null && (prefix === undefined || match[1] === prefix)
}
