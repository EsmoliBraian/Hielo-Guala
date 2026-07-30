import { OrderStatus, PaymentMethod, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../middleware/errorHandler.js";
import { parseOrderText } from "../../parser/orderParser.js";
import { buildAliasIndex } from "../aliases/aliases.service.js";

interface CreateOrderFromWhatsappInput {
  customerPhone: string;
  rawMessage: string;
  waMessageId: string;
  receivedAt: string;
}

/** Idempotent on waMessageId: WhatsApp/n8n webhook retries never duplicate an order. */
export async function createOrderFromWhatsapp(input: CreateOrderFromWhatsappInput) {
  const existing = await prisma.order.findUnique({
    where: { waMessageId: input.waMessageId },
    include: { items: { include: { product: true } } },
  });
  if (existing) return existing;

  const aliasIndex = await buildAliasIndex();
  const parsedItems = parseOrderText(input.rawMessage, aliasIndex);

  return prisma.order.create({
    data: {
      customerPhone: input.customerPhone,
      rawMessage: input.rawMessage,
      waMessageId: input.waMessageId,
      receivedAt: new Date(input.receivedAt),
      items: {
        create: parsedItems.map((item) => ({
          productId: item.productId,
          rawFragment: item.rawFragment,
          quantity: item.quantity,
          matched: item.matched,
        })),
      },
    },
    include: { items: { include: { product: true } } },
  });
}

interface CreateManualOrderInput {
  customerPhone?: string;
  items: { productId: string; quantity: number }[];
}

/**
 * For orders taken over the counter or by phone call — no WhatsApp message
 * behind it, so waMessageId stays null (nullable+unique, so this never
 * collides with a real WhatsApp order) and items are picked directly from
 * the product list instead of going through the text parser.
 */
export async function createManualOrder(input: CreateManualOrderInput) {
  const products = await prisma.product.findMany({
    where: { id: { in: input.items.map((item) => item.productId) }, active: true },
  });
  const productById = new Map(products.map((p) => [p.id, p]));

  const missing = input.items.find((item) => !productById.has(item.productId));
  if (missing) throw new HttpError(404, `Producto no encontrado: ${missing.productId}`);

  return prisma.order.create({
    data: {
      customerPhone: input.customerPhone?.trim() || "Mostrador",
      rawMessage: "Pedido cargado manualmente",
      receivedAt: new Date(),
      items: {
        create: input.items.map((item) => ({
          productId: item.productId,
          rawFragment: productById.get(item.productId)!.name,
          quantity: item.quantity,
          matched: true,
        })),
      },
    },
    include: { items: { include: { product: true } } },
  });
}

export async function markBotAnswered(orderId: string, success: boolean, error?: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new HttpError(404, "Pedido no encontrado");

  return prisma.order.update({
    where: { id: orderId },
    data: {
      botAnswered: success,
      botAnswerError: success ? null : (error ?? "Error desconocido"),
    },
  });
}

export function listOrders(status: OrderStatus = OrderStatus.PENDING) {
  return prisma.order.findMany({
    where: { status },
    include: { items: { include: { product: true } } },
    orderBy: { receivedAt: "asc" }, // FIFO: quien pidió primero aparece primero
  });
}

export function getOrder(id: string) {
  return prisma.order.findUnique({
    where: { id },
    include: {
      items: { include: { product: true } },
      sale: { include: { items: true } },
    },
  });
}

/**
 * Marks an order as delivered and snapshots a Sale + SaleItems from current
 * product prices, so future price changes never distort historical metrics.
 * Guarded in a transaction against double-delivery races.
 */
export async function deliverOrder(id: string, paymentMethod: PaymentMethod) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id },
      include: { items: { include: { product: true } } },
    });
    if (!order) throw new HttpError(404, "Pedido no encontrado");
    if (order.status !== OrderStatus.PENDING) {
      throw new HttpError(409, "El pedido ya fue entregado o cancelado");
    }

    const saleItemsData = order.items
      .filter((item) => item.product !== null)
      .map((item) => {
        const unitPrice = item.product!.price;
        return {
          productId: item.productId,
          productNameSnapshot: item.product!.name,
          quantity: item.quantity,
          unitPriceSnapshot: unitPrice,
          lineTotal: unitPrice.mul(item.quantity),
        };
      });

    const totalAmount = saleItemsData.reduce(
      (sum, item) => sum.add(item.lineTotal),
      new Prisma.Decimal(0),
    );

    const deliveredAt = new Date();

    const sale = await tx.sale.create({
      data: {
        orderId: id,
        deliveredAt,
        totalAmount,
        paymentMethod,
        items: { create: saleItemsData },
      },
      include: { items: true },
    });

    const updatedOrder = await tx.order.update({
      where: { id },
      data: { status: OrderStatus.DELIVERED, deliveredAt },
      include: { items: { include: { product: true } } },
    });

    return { order: updatedOrder, sale };
  });
}
