import { DiscountType, OrderStatus, PaymentMethod, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../middleware/errorHandler.js";
import { normalizePhone } from "../../lib/phone.js";
import {
  parseBulkOrderText,
  parseOrderText,
  type AliasEntry,
  type BulkOrderLine,
  type ParsedItem,
} from "../../parser/orderParser.js";
import { stripDiacritics } from "../../parser/textNormalize.js";
import { buildAliasIndex } from "../aliases/aliases.service.js";

/**
 * Phones allowed to dispatch several orders in one WhatsApp message (see
 * createBulkOrdersFromWhatsapp below) — normally just the owner's own number.
 * Regular customers' free text never happens to match that format, but this
 * keeps it opt-in rather than relying on that alone.
 */
const OWNER_PHONES = new Set(
  (process.env.OWNER_PHONES ?? "")
    .split(",")
    .map((phone) => phone.trim())
    .filter(Boolean)
    .map(normalizePhone),
);

interface CreateOrderFromWhatsappInput {
  customerPhone: string;
  rawMessage: string;
  waMessageId: string;
  receivedAt: string;
}

type OrderWithItems = Prisma.OrderGetPayload<{
  include: { items: { include: { product: true } } };
}>;

/** How long a conversation stays "open" (more items / the address / "Confirmar" still expected) after the last relevant message. */
const ORDER_CONVERSATION_WINDOW_MS = 60 * 60 * 1000;

async function findCustomerIdByPhone(phone: string): Promise<string | null> {
  const match = await prisma.customerPhone.findUnique({ where: { phone: normalizePhone(phone) } });
  return match?.customerId ?? null;
}

/**
 * The most recent order for this phone if its conversation is still "open" —
 * i.e. the customer hasn't sent "Confirmar" yet and the window hasn't expired.
 * While open, the next message is read as part of THIS order (more items, the
 * address, or the confirmation) instead of starting a new one.
 */
async function findOpenOrder(customerPhone: string) {
  const latest = await prisma.order.findFirst({
    where: { customerPhone, status: OrderStatus.PENDING },
    orderBy: { receivedAt: "desc" },
    include: { items: { include: { product: true } } },
  });
  if (!latest || latest.confirmedAt || !latest.addressRequestedAt) return null;

  const expired = Date.now() - latest.addressRequestedAt.getTime() > ORDER_CONVERSATION_WINDOW_MS;
  return expired ? null : latest;
}

interface OpenBulkGroup {
  stage: "awaiting_review" | "awaiting_confirm";
  siblings: OrderWithItems[];
  baseWaMessageId: string;
}

/**
 * The owner's most recent bulk dispatch, if it's still waiting on a "SI"/"NO"
 * review or a final "Confirmar" — same "open conversation" idea as
 * findOpenOrder, but keyed to the whole group of sibling orders instead of one.
 */
async function findOpenBulkGroup(ownerPhone: string): Promise<OpenBulkGroup | null> {
  const latest = await prisma.order.findFirst({
    where: {
      customerPhone: normalizePhone(ownerPhone),
      status: OrderStatus.PENDING,
      waMessageId: { contains: "#" },
    },
    orderBy: { receivedAt: "desc" },
  });
  if (!latest || latest.confirmedAt || !latest.addressRequestedAt) return null;

  const expired = Date.now() - latest.addressRequestedAt.getTime() > ORDER_CONVERSATION_WINDOW_MS;
  if (expired) return null;

  const baseWaMessageId = latest.waMessageId!.split("#")[0];
  const siblings = await prisma.order.findMany({
    where: { waMessageId: { startsWith: `${baseWaMessageId}#` }, status: OrderStatus.PENDING },
    include: { items: { include: { product: true } } },
    orderBy: { createdAt: "asc" },
  });
  if (siblings.length === 0) return null;

  return { stage: latest.reviewedAt ? "awaiting_confirm" : "awaiting_review", siblings, baseWaMessageId };
}

/** "Confirmar", "confirmar!", "Confirmar por favor" — not "confirmame la dirección" or similar. */
function isConfirmationMessage(text: string): boolean {
  return /^confirmar\b/.test(stripDiacritics(text.toLowerCase()).trim());
}

/** "Cancelar", "cancelar!", "Cancelar por favor". */
function isCancellationMessage(text: string): boolean {
  return /^cancelar\b/.test(stripDiacritics(text.toLowerCase()).trim());
}

/** "Si", "si!", "Si, dale" — the owner confirming a bulk dispatch was read correctly. */
function isAffirmativeMessage(text: string): boolean {
  return /^si\b/.test(stripDiacritics(text.toLowerCase()).trim());
}

/** "No", "no!", "No, esta mal" — the owner rejecting a bulk dispatch. */
function isNegativeMessage(text: string): boolean {
  return /^no\b/.test(stripDiacritics(text.toLowerCase()).trim());
}

/**
 * Builds the WhatsApp reply text server-side (instead of in n8n) so both the
 * Cloud API and Evolution workflows stay a thin transport layer.
 */
function buildOrderReplyText(items: OrderWithItems["items"], askAddress: boolean): string {
  const matched = items.filter((item) => item.matched);
  const unmatchedCount = items.length - matched.length;

  if (matched.length === 0) {
    return '🤔 Recibimos tu mensaje pero no pudimos identificar los productos. ¿Nos lo podés escribir de otra forma? (ej: "2 bolsitas y 1 bolson")';
  }

  let text = `🧊 Pedido recibido: ${matched
    .map((item) => `${item.quantity}x ${item.product!.name}`)
    .join(", ")}. ¡Gracias! 🙌`;

  if (unmatchedCount > 0) {
    text += " ⚠️ Una parte del pedido no la entendimos, en breve te lo confirmamos.";
  }
  if (askAddress) {
    text += ' 📍 ¿Nos confirmás la dirección de entrega? (local, calle y altura, depto, etc.) Y escribí "Confirmar" ✅ cuando el pedido esté completo.';
  }

  return text;
}

function summarizeMatchedItems(items: OrderWithItems["items"]): string {
  const matched = items.filter((item) => item.matched);
  return matched.length > 0
    ? matched.map((item) => `${item.quantity}x ${item.product!.name}`).join(", ")
    : "sin productos reconocidos";
}

/** Reply after a message got appended to an already-open order (more items, and/or still missing the address). */
function buildAppendReplyText(order: OrderWithItems, newItems: OrderWithItems["items"]): string {
  const newMatched = newItems.filter((item) => item.matched);

  let text =
    newMatched.length > 0
      ? `🧊 Sumamos: ${newMatched.map((item) => `${item.quantity}x ${item.product!.name}`).join(", ")}. `
      : "🤔 No identificamos productos en ese mensaje. ";

  text += `Tu pedido hasta ahora: ${summarizeMatchedItems(order.items)}.`;

  if (!order.deliveryAddress) {
    text += " 📍 ¿Nos confirmás la dirección de entrega?";
  }
  text += ' Escribí "Confirmar" ✅ cuando el pedido esté completo.';

  return text;
}

/** Reply once the customer sends "Confirmar" — closes the conversation with a final recap. */
function buildConfirmReplyText(order: OrderWithItems): string {
  const addressLine = order.deliveryAddress ? ` 📍 Dirección: ${order.deliveryAddress}.` : "";
  return `✅ ¡Pedido confirmado! 🧊 ${summarizeMatchedItems(order.items)}.${addressLine} Ya lo estamos preparando. ¡Gracias! 🙌`;
}

/** Reply once the customer sends "Cancelar" and there was an order to cancel. */
function buildCancelReplyText(order: OrderWithItems): string {
  return `❌ Listo, cancelamos tu pedido (${summarizeMatchedItems(order.items)}). Si te arrepentís, escribinos de nuevo. 🙌`;
}

function formatLabeledOrderLines(labeledOrders: { label: string; order: OrderWithItems }[]): string[] {
  return labeledOrders.map(({ label, order }) => {
    const matched = order.items.filter((item) => item.matched);
    const summary =
      matched.length > 0
        ? matched.map((item) => `${item.quantity}x ${item.product!.name}`).join(", ")
        : "sin productos reconocidos";
    return `${label}: ${summary}`;
  });
}

function buildBulkReplyText(labeledOrders: { label: string; order: OrderWithItems }[]): string {
  const lines = formatLabeledOrderLines(labeledOrders);
  return `📦 Cargamos ${lines.length} pedido${lines.length === 1 ? "" : "s"}:\n${lines.join("\n")}\n\n¿Es correcto? Respondé SI o NO.`;
}

/** Reply once the owner answers "SI" — the group moves from review to awaiting the final "Confirmar". */
function buildBulkReviewedReplyText(): string {
  return '👍 Genial. Escribí "Confirmar" ✅ para confirmar los pedidos.';
}

/** Reply once the owner answers "NO" — the whole batch gets cancelled and needs to be resent. */
function buildBulkResendReplyText(): string {
  return '❌ Ok, mandá de nuevo todos los pedidos bien escritos, uno por línea (ej: "20 bolsitas Nexus").';
}

/** Reply once the owner sends "Confirmar" — closes the whole bulk group with a final recap. */
function buildBulkConfirmedReplyText(labeledOrders: { label: string; order: OrderWithItems }[]): string {
  const lines = formatLabeledOrderLines(labeledOrders);
  return `✅ ¡Pedidos confirmados! 🧊\n${lines.join("\n")}\nYa los estamos preparando. 🙌`;
}

interface WhatsappOrderResult {
  order: OrderWithItems;
  replyText: string;
  addressCaptured: boolean;
}

/** One Order per line, all sharing `${waMessageId}#<index>` so a webhook retry never duplicates the batch. */
async function createBulkOrdersFromWhatsapp(
  input: CreateOrderFromWhatsappInput,
  bulkLines: BulkOrderLine[],
): Promise<WhatsappOrderResult> {
  const customerPhone = normalizePhone(input.customerPhone);
  const customerId = await findCustomerIdByPhone(customerPhone);
  const receivedAt = new Date(input.receivedAt);

  const createdOrders: OrderWithItems[] = [];
  for (let i = 0; i < bulkLines.length; i++) {
    const line = bulkLines[i];
    const order = await prisma.order.create({
      data: {
        customerPhone,
        rawMessage: line.rawFragment,
        waMessageId: `${input.waMessageId}#${i}`,
        receivedAt,
        customerId,
        deliveryAddress: line.label,
        addressRequestedAt: new Date(),
        items: {
          create: line.items.map((item) => ({
            productId: item.productId,
            rawFragment: item.rawFragment,
            quantity: item.quantity,
            matched: item.matched,
          })),
        },
      },
      include: { items: { include: { product: true } } },
    });
    createdOrders.push(order);
  }

  const replyText = buildBulkReplyText(
    createdOrders.map((order, i) => ({ label: bulkLines[i].label, order })),
  );

  return { order: createdOrders[0], replyText, addressCaptured: false };
}

/**
 * A 2+ line owner message that looks like an attempted dispatch list but has
 * a bad line (e.g. no client name after the product) never gets silently
 * merged into one order anymore — that used to hide the mistake behind an
 * unrelated "¿nos confirmás la dirección?" prompt. Instead it's saved as a
 * single order (so nothing is lost) with a reply pointing at the exact line
 * to fix, and the owner just resends the corrected full list.
 */
async function createBulkParseFailureOrder(
  input: CreateOrderFromWhatsappInput,
  failedLine: string,
  aliasIndex: AliasEntry[],
): Promise<WhatsappOrderResult> {
  const parsedItems = parseOrderText(input.rawMessage, aliasIndex);
  const customerId = await findCustomerIdByPhone(input.customerPhone);

  const order = await prisma.order.create({
    data: {
      customerPhone: normalizePhone(input.customerPhone),
      rawMessage: input.rawMessage,
      waMessageId: input.waMessageId,
      receivedAt: new Date(input.receivedAt),
      customerId,
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

  const replyText = `🤔 No pudimos separar los pedidos por cliente. Cada línea necesita: cantidad + producto + cliente (ej: "15 bolsitas Jose"). Esta línea no tiene cliente: "${failedLine}". Te dejamos todo como un solo pedido pendiente — corregilo y volvé a mandar la lista completa.`;

  return { order, replyText, addressCaptured: false };
}

/** Adds more items to an already-open order (customer sent a follow-up message instead of a fresh order). */
async function appendItemsToOrder(order: OrderWithItems, newItems: ParsedItem[], newRawMessage: string) {
  const createdItems = await Promise.all(
    newItems.map((item) =>
      prisma.orderItem.create({
        data: {
          orderId: order.id,
          productId: item.productId,
          rawFragment: item.rawFragment,
          quantity: item.quantity,
          matched: item.matched,
        },
        include: { product: true },
      }),
    ),
  );

  const updatedOrder = await prisma.order.update({
    where: { id: order.id },
    data: { rawMessage: `${order.rawMessage}\n${newRawMessage}` },
    include: { items: { include: { product: true } } },
  });

  return { order: updatedOrder, newItems: createdItems };
}

/**
 * Idempotent on waMessageId: WhatsApp/n8n webhook retries never duplicate an order
 * (a bulk dispatch stores `${waMessageId}#0`, `#1`, ... instead of the bare id,
 * so the lookup below checks for either shape).
 *
 * While a customer's order is "open" (see findOpenOrder), their next message is
 * read in context instead of starting a new order: "Confirmar" closes it, text
 * with recognizable products gets appended to it, and anything else is taken as
 * the delivery address if that's still missing. No NLP — same rule-based parser
 * the rest of the app already uses, just applied across turns of the conversation.
 */
export async function createOrderFromWhatsapp(
  input: CreateOrderFromWhatsappInput,
): Promise<WhatsappOrderResult> {
  const existing = await prisma.order.findFirst({
    where: {
      OR: [{ waMessageId: input.waMessageId }, { waMessageId: { startsWith: `${input.waMessageId}#` } }],
    },
    include: { items: { include: { product: true } } },
    orderBy: { createdAt: "asc" },
  });
  if (existing) {
    if (existing.waMessageId?.includes("#")) {
      const baseWaMessageId = existing.waMessageId.split("#")[0];
      const siblings = await prisma.order.findMany({
        where: { waMessageId: { startsWith: `${baseWaMessageId}#` } },
        include: { items: { include: { product: true } } },
        orderBy: { createdAt: "asc" },
      });
      const replyText = buildBulkReplyText(
        siblings.map((order) => ({ label: order.deliveryAddress ?? "", order })),
      );
      return { order: existing, replyText, addressCaptured: false };
    }
    return { order: existing, replyText: buildOrderReplyText(existing.items, false), addressCaptured: false };
  }

  if (isCancellationMessage(input.rawMessage)) {
    const cancellable = await prisma.order.findFirst({
      where: { customerPhone: normalizePhone(input.customerPhone), status: OrderStatus.PENDING },
      orderBy: { receivedAt: "desc" },
    });
    if (cancellable) {
      const cancelled = await cancelOrder(cancellable.id);
      return { order: cancelled, replyText: buildCancelReplyText(cancelled), addressCaptured: false };
    }
    // Nothing pending to cancel — fall through and let it parse as a normal message below.
  }

  const aliasIndex = await buildAliasIndex();

  if (OWNER_PHONES.has(normalizePhone(input.customerPhone))) {
    const bulkResult = parseBulkOrderText(input.rawMessage, aliasIndex);
    if (bulkResult) {
      if (bulkResult.ok) return createBulkOrdersFromWhatsapp(input, bulkResult.lines);
      return createBulkParseFailureOrder(input, bulkResult.failedLine, aliasIndex);
    }

    const bulkGroup = await findOpenBulkGroup(input.customerPhone);
    if (bulkGroup) {
      const labeledOrders = bulkGroup.siblings.map((order) => ({ label: order.deliveryAddress ?? "", order }));

      if (bulkGroup.stage === "awaiting_review") {
        if (isAffirmativeMessage(input.rawMessage)) {
          await prisma.order.updateMany({
            where: { waMessageId: { startsWith: `${bulkGroup.baseWaMessageId}#` } },
            data: { reviewedAt: new Date() },
          });
          return { order: bulkGroup.siblings[0], replyText: buildBulkReviewedReplyText(), addressCaptured: false };
        }
        if (isNegativeMessage(input.rawMessage)) {
          await prisma.order.updateMany({
            where: { waMessageId: { startsWith: `${bulkGroup.baseWaMessageId}#` } },
            data: { status: OrderStatus.CANCELLED },
          });
          return { order: bulkGroup.siblings[0], replyText: buildBulkResendReplyText(), addressCaptured: false };
        }
        return {
          order: bulkGroup.siblings[0],
          replyText: '🤔 Respondé "SI" si está todo correcto, o "NO" si hay que corregir algo.',
          addressCaptured: false,
        };
      }

      // awaiting_confirm
      if (isConfirmationMessage(input.rawMessage)) {
        await prisma.order.updateMany({
          where: { waMessageId: { startsWith: `${bulkGroup.baseWaMessageId}#` } },
          data: { confirmedAt: new Date() },
        });
        return { order: bulkGroup.siblings[0], replyText: buildBulkConfirmedReplyText(labeledOrders), addressCaptured: false };
      }
      return {
        order: bulkGroup.siblings[0],
        replyText: '🤔 Escribí "Confirmar" ✅ para confirmar los pedidos.',
        addressCaptured: false,
      };
    }
  }

  const openOrder = await findOpenOrder(input.customerPhone);

  if (openOrder) {
    if (isConfirmationMessage(input.rawMessage)) {
      const confirmed = await prisma.order.update({
        where: { id: openOrder.id },
        data: { confirmedAt: new Date() },
        include: { items: { include: { product: true } } },
      });
      return { order: confirmed, replyText: buildConfirmReplyText(confirmed), addressCaptured: false };
    }

    const followUpItems = parseOrderText(input.rawMessage, aliasIndex);
    if (followUpItems.some((item) => item.matched)) {
      const { order: updated, newItems } = await appendItemsToOrder(openOrder, followUpItems, input.rawMessage);
      return { order: updated, replyText: buildAppendReplyText(updated, newItems), addressCaptured: false };
    }

    if (!openOrder.deliveryAddress) {
      const deliveryAddress = input.rawMessage.trim();
      const order = await prisma.order.update({
        where: { id: openOrder.id },
        data: { deliveryAddress },
        include: { items: { include: { product: true } } },
      });
      return {
        order,
        replyText: `📍 ¡Gracias! Guardamos la dirección de entrega: "${deliveryAddress}". Escribí "Confirmar" ✅ cuando el pedido esté completo.`,
        addressCaptured: true,
      };
    }

    // Address already set, message didn't add products, and it wasn't "Confirmar" —
    // ambiguous, so ask instead of guessing (this is exactly the bug that used to
    // silently overwrite the address with whatever the customer typed next).
    return {
      order: openOrder,
      replyText:
        '🤔 No identificamos productos en ese mensaje. Si tu pedido ya está completo, escribí "Confirmar" ✅. Si querés agregar algo más, contanos qué (ej: "2 bolsitas").',
      addressCaptured: false,
    };
  }

  const parsedItems = parseOrderText(input.rawMessage, aliasIndex);
  const matchedCount = parsedItems.filter((item) => item.matched).length;
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
  customerId?: string;
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

  let customerPhone = "Mostrador";
  let customerId: string | null = null;
  if (input.customerId) {
    const customer = await prisma.customer.findUnique({
      where: { id: input.customerId },
      include: { phones: true },
    });
    if (!customer) throw new HttpError(404, "Cliente no encontrado");
    customerId = customer.id;
    customerPhone = customer.phones[0]?.phone ?? "Mostrador";
  }

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

/**
 * Links an order (typically a WhatsApp order that arrived from an unknown phone) to a customer.
 * If the order's phone isn't registered to any customer yet, it also gets registered to this one
 * (and any other orderless-customer orders from that same phone get backfilled) — so future
 * WhatsApp orders from that number link automatically instead of needing this every time.
 * Skipped for non-phone sources (manual counter orders default to customerPhone "Mostrador"),
 * and left alone if the phone is already registered to a *different* customer.
 */
export async function assignCustomer(orderId: string, customerId: string) {
  const [order, customer] = await Promise.all([
    prisma.order.findUnique({ where: { id: orderId } }),
    prisma.customer.findUnique({ where: { id: customerId } }),
  ]);
  if (!order) throw new HttpError(404, "Pedido no encontrado");
  if (!customer) throw new HttpError(404, "Cliente no encontrado");

  const phone = normalizePhone(order.customerPhone);
  if (/^\d+$/.test(phone)) {
    const existingPhoneLink = await prisma.customerPhone.findUnique({ where: { phone } });
    if (!existingPhoneLink) {
      await prisma.customerPhone.create({ data: { phone, customerId } });
      await prisma.order.updateMany({
        where: { customerPhone: phone, customerId: null },
        data: { customerId },
      });
    }
  }

  return prisma.order.update({
    where: { id: orderId },
    data: { customerId },
    include: {
      items: { include: { product: true } },
      sale: true,
      customer: { select: { name: true } },
    },
  });
}

export async function markBotAnswered(orderId: string, success: boolean, error?: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new HttpError(404, "Pedido no encontrado");

  const data = { botAnswered: success, botAnswerError: success ? null : (error ?? "Error desconocido") };

  // Bulk dispatch (waMessageId "<id>#<index>"): one WhatsApp reply covers every
  // order created from that message, so the confirmation applies to all of them.
  const hashIndex = order.waMessageId?.indexOf("#") ?? -1;
  if (hashIndex > 0) {
    const baseWaMessageId = order.waMessageId!.slice(0, hashIndex);
    await prisma.order.updateMany({
      where: { waMessageId: { startsWith: `${baseWaMessageId}#` } },
      data,
    });
  }

  return prisma.order.update({ where: { id: orderId }, data });
}

export function listOrders(status: OrderStatus = OrderStatus.PENDING) {
  return prisma.order.findMany({
    where: { status },
    include: { items: { include: { product: true } }, customer: { select: { name: true } } },
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
      customer: { select: { name: true } },
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

interface DeliverOrderInput {
  paymentMethod: PaymentMethod;
  discount?: { type: DiscountType; value: number } | null;
  /** Links (or overrides) the customer at delivery time — required when paymentMethod is DEBT and the order has no customer yet. */
  customerId?: string | null;
  /** Custom unit price per OrderItem id, overriding the catalog price for that line — can go up or down, unlike `discount` which only ever reduces the subtotal. */
  itemPrices?: Record<string, number>;
}

/**
 * Marks an order as delivered and snapshots a Sale + SaleItems from current
 * product prices, so future price changes never distort historical metrics.
 * Guarded in a transaction against double-delivery races.
 */
export async function deliverOrder(id: string, input: DeliverOrderInput) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id },
      include: { items: { include: { product: true } } },
    });
    if (!order) throw new HttpError(404, "Pedido no encontrado");
    if (order.status !== OrderStatus.PENDING) {
      throw new HttpError(409, "El pedido ya fue entregado o cancelado");
    }

    const customerId = input.customerId !== undefined ? input.customerId : order.customerId;
    if (input.paymentMethod === PaymentMethod.DEBT && !customerId) {
      throw new HttpError(400, "Para cargar una deuda pendiente hay que vincular un cliente");
    }
    if (customerId && customerId !== order.customerId) {
      const customer = await tx.customer.findUnique({ where: { id: customerId } });
      if (!customer) throw new HttpError(404, "Cliente no encontrado");
    }

    const saleItemsData = order.items
      .filter((item) => item.product !== null)
      .map((item) => {
        const customPrice = input.itemPrices?.[item.id];
        const unitPrice = customPrice !== undefined ? new Prisma.Decimal(customPrice) : item.product!.price;
        return {
          productId: item.productId,
          productNameSnapshot: item.product!.name,
          quantity: item.quantity,
          unitPriceSnapshot: unitPrice,
          lineTotal: unitPrice.mul(item.quantity),
        };
      });

    const subtotalAmount = saleItemsData.reduce(
      (sum, item) => sum.add(item.lineTotal),
      new Prisma.Decimal(0),
    );

    let discountType: DiscountType | null = null;
    let discountValue: Prisma.Decimal | null = null;
    let discountAmount = new Prisma.Decimal(0);
    if (input.discount && input.discount.value > 0) {
      discountType = input.discount.type;
      discountValue = new Prisma.Decimal(input.discount.value);
      discountAmount =
        discountType === DiscountType.PERCENTAGE
          ? subtotalAmount.mul(discountValue).div(100)
          : discountValue;
      if (discountAmount.greaterThan(subtotalAmount)) discountAmount = subtotalAmount;
    }

    const totalAmount = subtotalAmount.sub(discountAmount);
    const deliveredAt = new Date();

    const sale = await tx.sale.create({
      data: {
        orderId: id,
        deliveredAt,
        totalAmount,
        subtotalAmount,
        discountType,
        discountValue,
        paymentMethod: input.paymentMethod,
        items: { create: saleItemsData },
      },
      include: { items: true },
    });

    const updatedOrder = await tx.order.update({
      where: { id },
      data: { status: OrderStatus.DELIVERED, deliveredAt, customerId },
      include: { items: { include: { product: true } } },
    });

    return { order: updatedOrder, sale };
  });
}

/** Marks a DEBT sale as paid off. */
export async function settleDebt(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { sale: true } });
  if (!order || !order.sale) throw new HttpError(404, "Venta no encontrada");
  if (order.sale.paymentMethod !== PaymentMethod.DEBT) {
    throw new HttpError(409, "Esta venta no es una deuda pendiente");
  }
  if (order.sale.debtSettledAt) throw new HttpError(409, "La deuda ya estaba saldada");

  await prisma.sale.update({ where: { id: order.sale.id }, data: { debtSettledAt: new Date() } });
  return getOrder(orderId);
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
