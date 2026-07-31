import { OrderStatus, PaymentMethod, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../middleware/errorHandler.js";
import { normalizePhone } from "../../lib/phone.js";
import { parseOrderText } from "../../parser/orderParser.js";
import { buildAliasIndex } from "../aliases/aliases.service.js";

interface CreateOrderFromWhatsappInput {
  customerPhone: string;
  rawMessage: string;
  waMessageId: string;
  receivedAt: string;
}

type OrderWithItems = Prisma.OrderGetPayload<{
  include: { items: { include: { product: true } } };
}>;

/** How long after asking for an address we still treat the customer's next message as the answer. */
const ADDRESS_REQUEST_WINDOW_MS = 60 * 60 * 1000;

async function findCustomerIdByPhone(phone: string): Promise<string | null> {
  const match = await prisma.customerPhone.findUnique({ where: { phone: normalizePhone(phone) } });
  return match?.customerId ?? null;
}

/** The most recent order for this phone if it's still waiting on an address reply. */
async function findPendingAddressOrder(customerPhone: string) {
  const latest = await prisma.order.findFirst({
    where: { customerPhone },
    orderBy: { receivedAt: "desc" },
  });
  if (!latest || latest.deliveryAddress !== null || !latest.addressRequestedAt) return null;

  const expired = Date.now() - latest.addressRequestedAt.getTime() > ADDRESS_REQUEST_WINDOW_MS;
  return expired ? null : latest;
}

/**
 * Builds the WhatsApp reply text server-side (instead of in n8n) so both the
 * Cloud API and Evolution workflows stay a thin transport layer.
 */
function buildOrderReplyText(items: OrderWithItems["items"], askAddress: boolean): string {
  const matched = items.filter((item) => item.matched);
  const unmatchedCount = items.length - matched.length;

  if (matched.length === 0) {
    return 'Recibimos tu mensaje pero no pudimos identificar los productos. ¿Nos lo podés escribir de otra forma? (ej: "2 bolsitas y 1 bolson")';
  }

  let text = `Pedido recibido: ${matched
    .map((item) => `${item.quantity}x ${item.product!.name}`)
    .join(", ")}. ¡Gracias!`;

  if (unmatchedCount > 0) {
    text += " Una parte del pedido no la entendimos, en breve te lo confirmamos.";
  }
  if (askAddress) {
    text += " ¿Nos confirmás la dirección de entrega? (local, calle y altura, depto, etc.)";
  }

  return text;
}

interface WhatsappOrderResult {
  order: OrderWithItems;
  replyText: string;
  addressCaptured: boolean;
}

/**
 * Idempotent on waMessageId: WhatsApp/n8n webhook retries never duplicate an order.
 *
 * A message is treated as the answer to a pending "¿cuál es la dirección?" question
 * (instead of a new order) when the parser can't match a single product in it and
 * the customer's last order is still waiting on an address — no NLP, just the same
 * rule-based parser the rest of the app already uses.
 */
export async function createOrderFromWhatsapp(
  input: CreateOrderFromWhatsappInput,
): Promise<WhatsappOrderResult> {
  const existing = await prisma.order.findUnique({
    where: { waMessageId: input.waMessageId },
    include: { items: { include: { product: true } } },
  });
  if (existing) {
    return { order: existing, replyText: buildOrderReplyText(existing.items, false), addressCaptured: false };
  }

  const aliasIndex = await buildAliasIndex();
  const parsedItems = parseOrderText(input.rawMessage, aliasIndex);
  const matchedCount = parsedItems.filter((item) => item.matched).length;

  const pendingAddressOrder =
    matchedCount === 0 ? await findPendingAddressOrder(input.customerPhone) : null;

  if (pendingAddressOrder) {
    const deliveryAddress = input.rawMessage.trim();
    const order = await prisma.order.update({
      where: { id: pendingAddressOrder.id },
      data: { deliveryAddress },
      include: { items: { include: { product: true } } },
    });
    return {
      order,
      replyText: `¡Gracias! Guardamos la dirección de entrega: "${deliveryAddress}".`,
      addressCaptured: true,
    };
  }

  const customerId = await findCustomerIdByPhone(input.customerPhone);
  const askAddress = matchedCount > 0;

  const order = await prisma.order.create({
    data: {
      customerPhone: normalizePhone(input.customerPhone),
      rawMessage: input.rawMessage,
      waMessageId: input.waMessageId,
      receivedAt: new Date(input.receivedAt),
      customerId,
      addressRequestedAt: askAddress ? new Date() : null,
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

  return { order, replyText: buildOrderReplyText(order.items, askAddress), addressCaptured: false };
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

  const customerPhone = input.customerPhone?.trim() ? normalizePhone(input.customerPhone) : "Mostrador";
  const customerId = await findCustomerIdByPhone(customerPhone);

  return prisma.order.create({
    data: {
      customerPhone,
      customerId,
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

interface HistoryFilters {
  days: number;
  /** Specific calendar day (YYYY-MM-DD, Argentina timezone) — overrides `days` when set. */
  date?: string;
  customerId?: string;
}

/** Delivered + cancelled orders, most recent first — by day count or a specific calendar date. */
export function listOrderHistory({ days, date, customerId }: HistoryFilters) {
  const where: Prisma.OrderWhereInput = {
    status: { in: [OrderStatus.DELIVERED, OrderStatus.CANCELLED] },
  };

  if (date) {
    // Argentina has used a fixed UTC-3 offset (no DST) since 2009.
    where.receivedAt = {
      gte: new Date(`${date}T00:00:00-03:00`),
      lte: new Date(`${date}T23:59:59.999-03:00`),
    };
  } else {
    const since = new Date();
    since.setDate(since.getDate() - days);
    where.receivedAt = { gte: since };
  }

  if (customerId) where.customerId = customerId;

  return prisma.order.findMany({
    where,
    include: {
      items: { include: { product: true } },
      sale: true,
    },
    orderBy: { updatedAt: "desc" },
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

/**
 * Cancels an order — from PENDING (never delivered) or from DELIVERED
 * (undoing a mistaken "Entregado"). In the DELIVERED case, the Sale/SaleItem
 * snapshot is deleted too, so a cancelled order never lingers in metrics.
 */
export async function cancelOrder(id: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id } });
    if (!order) throw new HttpError(404, "Pedido no encontrado");
    if (order.status === OrderStatus.CANCELLED) {
      throw new HttpError(409, "El pedido ya está cancelado");
    }

    if (order.status === OrderStatus.DELIVERED) {
      await tx.sale.deleteMany({ where: { orderId: id } });
    }

    return tx.order.update({
      where: { id },
      data: { status: OrderStatus.CANCELLED, deliveredAt: null },
      include: { items: { include: { product: true } } },
    });
  });
}
