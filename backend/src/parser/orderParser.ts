import { SPANISH_NUMBER_WORDS } from "./numberWords.js";
import { stripDiacritics } from "./textNormalize.js";

export interface AliasEntry {
  /** Already normalized (lowercase, no accents) product alias. */
  alias: string;
  productId: string;
  weightKg: number;
}

export interface ParsedItem {
  productId: string | null;
  rawFragment: string;
  quantity: number;
  matched: boolean;
}

function normalize(text: string): string {
  return stripDiacritics(text.toLowerCase())
    .replace(/[.;!?]/g, " ") // keep ',' — it's a segment separator
    .replace(/\s+/g, " ")
    .trim();
}

function segment(text: string): string[] {
  return text
    .split(/\s+y\s+|,|\+|\s+mas\s+|\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function extractQuantity(segmentText: string): { quantity: number; rest: string } {
  const words = segmentText.split(" ");

  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    if (/^\d+$/.test(word)) {
      const rest = [...words.slice(0, i), ...words.slice(i + 1)].join(" ").trim();
      return { quantity: parseInt(word, 10), rest };
    }

    const attached = word.match(/^(\d+)([a-z]+)$/);
    if (attached) {
      const rest = [...words.slice(0, i), attached[2], ...words.slice(i + 1)].join(" ").trim();
      return { quantity: parseInt(attached[1], 10), rest };
    }

    if (word in SPANISH_NUMBER_WORDS) {
      const rest = [...words.slice(0, i), ...words.slice(i + 1)].join(" ").trim();
      return { quantity: SPANISH_NUMBER_WORDS[word], rest };
    }
  }

  return { quantity: 1, rest: segmentText };
}

function stripPlural(word: string): string {
  return word.endsWith("s") ? word.slice(0, -1) : word;
}

function singularizeWords(text: string): string {
  return text.split(" ").map(stripPlural).join(" ");
}

function matchAlias(rest: string, aliasIndex: AliasEntry[]): AliasEntry | null {
  if (!rest) return null;

  const sorted = [...aliasIndex].sort((a, b) => b.alias.length - a.alias.length);
  const restSingular = singularizeWords(rest);

  for (const entry of sorted) {
    if (rest === entry.alias) return entry;
  }

  for (const entry of sorted) {
    if (restSingular === singularizeWords(entry.alias)) return entry;
  }

  for (const entry of sorted) {
    if (restSingular.includes(singularizeWords(entry.alias))) return entry;
  }

  return null;
}

/** Matches an explicit weight mention — "3kg" glued or spaced, or "de 3" (kg implied, e.g. "bolsa de 2"). */
function matchByWeightRegex(rest: string, aliasIndex: AliasEntry[]): AliasEntry | null {
  const weightMatch = rest.match(/(\d+)\s?kg\b/) ?? rest.match(/\bde\s+(\d+)\b/);
  if (!weightMatch) return null;

  const weightKg = parseInt(weightMatch[1], 10);
  return aliasIndex.find((entry) => entry.weightKg === weightKg) ?? null;
}

/**
 * Pure, rule-based parser for free-text WhatsApp orders (e.g. "3bolsitas y 1 bolson").
 * Never drops a fragment it can't recognize — unmatched pieces come back as
 * items with matched:false so the order can still be created for manual review.
 */
export function parseOrderText(text: string, aliasIndex: AliasEntry[]): ParsedItem[] {
  const normalized = normalize(text);
  if (!normalized) return [];

  return segment(normalized).map((seg) => {
    const { quantity, rest } = extractQuantity(seg);
    // An explicit weight ("de 2", "3kg") always wins over a generic word alias
    // like the bare "bolsa" — otherwise "bolsa de 2" got swallowed as the
    // generic 3kg fallback before ever considering the "2" right next to it.
    const match = matchByWeightRegex(rest, aliasIndex) ?? matchAlias(rest, aliasIndex);

    return {
      productId: match ? match.productId : null,
      rawFragment: seg,
      quantity,
      matched: Boolean(match),
    };
  });
}

export interface BulkOrderLine {
  /** Whatever follows the dash — a delivery point, not necessarily a full address. */
  label: string;
  rawFragment: string;
  items: ParsedItem[];
}

/**
 * "30 bolsitas - Obrador\n2 bolsones - el puesto" → one order per line, each
 * addressed to whatever follows the dash. Meant only for the owner dispatching
 * several orders from their own number in one message — a regular customer's
 * free text never happens to look like this, so there's no ambiguity with the
 * normal single-order parser above.
 *
 * Returns null (caller falls back to a normal single order) if any line
 * doesn't fit the "<items> - <label>" shape or has zero recognizable items —
 * an all-or-nothing check so a message either reads entirely as a dispatch
 * list or entirely as free text, never a confusing mix.
 */
export function parseBulkOrderText(text: string, aliasIndex: AliasEntry[]): BulkOrderLine[] | null {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;

  const result: BulkOrderLine[] = [];
  for (const line of lines) {
    const match = line.match(/^(.+?)\s+-\s+(.+)$/);
    if (!match) return null;

    const [, itemsText, label] = match;
    const items = parseOrderText(itemsText, aliasIndex);
    if (items.length === 0 || items.every((item) => !item.matched)) return null;

    result.push({ label: label.trim(), rawFragment: itemsText.trim(), items });
  }

  return result;
}
