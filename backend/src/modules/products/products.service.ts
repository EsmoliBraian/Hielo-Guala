import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../middleware/errorHandler.js";

export function listProducts(includeInactive = false) {
  return prisma.product.findMany({
    where: includeInactive ? {} : { active: true },
    include: { aliases: true },
    orderBy: { weightKg: "asc" },
  });
}

export function createProduct(data: { name: string; weightKg: number; price: number }) {
  return prisma.product.create({ data });
}

export async function updateProduct(
  id: string,
  data: Partial<{ name: string; weightKg: number; price: number; active: boolean }>,
) {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw new HttpError(404, "Producto no encontrado");

  return prisma.product.update({ where: { id }, data });
}

export async function deactivateProduct(id: string) {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw new HttpError(404, "Producto no encontrado");

  return prisma.product.update({ where: { id }, data: { active: false } });
}
