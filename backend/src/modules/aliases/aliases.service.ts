import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../middleware/errorHandler.js";
import type { AliasEntry } from "../../parser/orderParser.js";
import { stripDiacritics } from "../../parser/textNormalize.js";

function normalizeAlias(alias: string): string {
  return stripDiacritics(alias.toLowerCase()).trim();
}

export function listAliasesForProduct(productId: string) {
  return prisma.productAlias.findMany({ where: { productId } });
}

export async function createAlias(productId: string, alias: string) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new HttpError(404, "Producto no encontrado");

  const normalized = normalizeAlias(alias);
  const existing = await prisma.productAlias.findUnique({ where: { alias: normalized } });
  if (existing) throw new HttpError(409, "Ese alias ya está en uso");

  return prisma.productAlias.create({ data: { productId, alias: normalized } });
}

export async function deleteAlias(id: string) {
  const alias = await prisma.productAlias.findUnique({ where: { id } });
  if (!alias) throw new HttpError(404, "Alias no encontrado");

  await prisma.productAlias.delete({ where: { id } });
}

/** Builds the alias index the order parser needs, straight from the DB. */
export async function buildAliasIndex(): Promise<AliasEntry[]> {
  const aliases = await prisma.productAlias.findMany({
    where: { product: { active: true } },
    include: { product: true },
  });

  return aliases.map((entry) => ({
    alias: normalizeAlias(entry.alias),
    productId: entry.productId,
    weightKg: entry.product.weightKg,
  }));
}
