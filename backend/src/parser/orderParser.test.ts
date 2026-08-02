import { describe, expect, it } from "vitest";
import { parseBulkOrderText, parseOrderText, type AliasEntry } from "./orderParser.js";

const aliasIndex: AliasEntry[] = [
  { alias: "bolsita", productId: "p2kg", weightKg: 2 },
  { alias: "bolsitas", productId: "p2kg", weightKg: 2 },
  { alias: "hielo chico", productId: "p2kg", weightKg: 2 },
  { alias: "bolsa de melin", productId: "p3kg", weightKg: 3 },
  { alias: "melin", productId: "p3kg", weightKg: 3 },
  { alias: "bolsa", productId: "p3kg", weightKg: 3 },
  { alias: "bolson", productId: "p10kg", weightKg: 10 },
  { alias: "hielo grande", productId: "p10kg", weightKg: 10 },
];

describe("parseOrderText", () => {
  it("parses quantity glued to the product word", () => {
    const items = parseOrderText("3bolsitas y 1 bolson", aliasIndex);

    expect(items).toEqual([
      { productId: "p2kg", rawFragment: "3bolsitas", quantity: 3, matched: true },
      { productId: "p10kg", rawFragment: "1 bolson", quantity: 1, matched: true },
    ]);
  });

  it("matches the longer, more specific alias over the bare fallback", () => {
    const items = parseOrderText("2 bolsas de melin y una bolsita", aliasIndex);

    expect(items).toEqual([
      { productId: "p3kg", rawFragment: "2 bolsas de melin", quantity: 2, matched: true },
      { productId: "p2kg", rawFragment: "una bolsita", quantity: 1, matched: true },
    ]);
  });

  it("finds a quantity that isn't the first word in the segment", () => {
    const items = parseOrderText("dame 5 hielos chicos", aliasIndex);

    expect(items).toEqual([
      { productId: "p2kg", rawFragment: "dame 5 hielos chicos", quantity: 5, matched: true },
    ]);
  });

  it("defaults quantity to 1 when none is present", () => {
    const items = parseOrderText("dame un bolson", aliasIndex);

    expect(items).toEqual([
      { productId: "p10kg", rawFragment: "dame un bolson", quantity: 1, matched: true },
    ]);
  });

  it("falls back to the bare alias when no size is specified", () => {
    const items = parseOrderText("quiero una bolsa", aliasIndex);

    expect(items).toEqual([
      { productId: "p3kg", rawFragment: "quiero una bolsa", quantity: 1, matched: true },
    ]);
  });

  it("matches a direct weight mention even without a configured alias", () => {
    const items = parseOrderText("2 de 3kg", aliasIndex);

    expect(items).toEqual([
      { productId: "p3kg", rawFragment: "2 de 3kg", quantity: 2, matched: true },
    ]);
  });

  it('prefers an explicit "de N" weight over the generic bare "bolsa" alias', () => {
    const items = parseOrderText("1 bolsa de 2 y 4 de 10", aliasIndex);

    expect(items).toEqual([
      { productId: "p2kg", rawFragment: "1 bolsa de 2", quantity: 1, matched: true },
      { productId: "p10kg", rawFragment: "4 de 10", quantity: 4, matched: true },
    ]);
  });

  it("keeps unrecognized text as an unmatched item instead of dropping the order", () => {
    const items = parseOrderText("hola", aliasIndex);

    expect(items).toEqual([
      { productId: null, rawFragment: "hola", quantity: 1, matched: false },
    ]);
  });

  it("returns an empty list for blank text", () => {
    expect(parseOrderText("   ", aliasIndex)).toEqual([]);
  });

  it("handles comma-separated segments", () => {
    const items = parseOrderText("2 bolsitas, 1 bolson", aliasIndex);

    expect(items).toEqual([
      { productId: "p2kg", rawFragment: "2 bolsitas", quantity: 2, matched: true },
      { productId: "p10kg", rawFragment: "1 bolson", quantity: 1, matched: true },
    ]);
  });
});

describe("parseBulkOrderText", () => {
  it("splits one order per line, addressed to whatever follows the dash", () => {
    const lines = parseBulkOrderText("30 bolsitas - Obrador\n2 bolsones - el puesto", aliasIndex);

    expect(lines).toEqual([
      {
        label: "Obrador",
        rawFragment: "30 bolsitas",
        items: [{ productId: "p2kg", rawFragment: "30 bolsitas", quantity: 30, matched: true }],
      },
      {
        label: "el puesto",
        rawFragment: "2 bolsones",
        items: [{ productId: "p10kg", rawFragment: "2 bolsones", quantity: 2, matched: true }],
      },
    ]);
  });

  it("allows more than one product per destination", () => {
    const lines = parseBulkOrderText("30 bolsitas y 2 bolsones - Obrador", aliasIndex);

    expect(lines).toEqual([
      {
        label: "Obrador",
        rawFragment: "30 bolsitas y 2 bolsones",
        items: [
          { productId: "p2kg", rawFragment: "30 bolsitas", quantity: 30, matched: true },
          { productId: "p10kg", rawFragment: "2 bolsones", quantity: 2, matched: true },
        ],
      },
    ]);
  });

  it("bails out (returns null) when a line doesn't have a dash", () => {
    expect(parseBulkOrderText("30 bolsitas - Obrador\n2 bolsitas y 1 bolson", aliasIndex)).toBeNull();
  });

  it("bails out when a line's items are entirely unrecognized", () => {
    expect(parseBulkOrderText("hola - Obrador", aliasIndex)).toBeNull();
  });

  it("returns null for blank text", () => {
    expect(parseBulkOrderText("   ", aliasIndex)).toBeNull();
  });
});
