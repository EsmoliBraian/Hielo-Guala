/**
 * Digits-only phone key used to match a WhatsApp sender against a Customer's
 * registered phones, regardless of how each one is formatted (+, spaces, dashes).
 * Falls back to the trimmed original when there are no digits at all (e.g. "Mostrador").
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits || phone.trim();
}
