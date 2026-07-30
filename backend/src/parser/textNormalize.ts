// Unicode combining diacritical marks (U+0300-U+036F), left behind by
// `.normalize("NFD")` when stripping accents (e.g. bolsón -> boldon + mark).
const DIACRITICS_REGEX = new RegExp(
  `[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`,
  "g",
);

export function stripDiacritics(text: string): string {
  return text.normalize("NFD").replace(DIACRITICS_REGEX, "");
}
