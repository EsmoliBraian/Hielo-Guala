import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../middleware/errorHandler.js";
import { normalizePhone } from "../../lib/phone.js";

interface CustomerPhonesInput {
  name: string;
  notes?: string | null;
  phones: string[];
}

interface UpdateCustomerInput {
  name?: string;
  notes?: string | null;
  phones?: string[];
}

function dedupePhones(phones: string[]): string[] {
  return Array.from(new Set(phones.map(normalizePhone).filter(Boolean)));
}

async function assertPhonesAvailable(phones: string[], excludingCustomerId?: string) {
  const conflicting = await prisma.customerPhone.findMany({
    where: {
      phone: { in: phones },
      ...(excludingCustomerId ? { customerId: { not: excludingCustomerId } } : {}),
    },
  });
  if (conflicting.length > 0) {
    throw new HttpError(409, `El número ${conflicting[0].phone} ya está asociado a otro cliente`);
  }
}

/** Links any past orders from these phones (WhatsApp or manual) to the customer. */
function backfillOrders(customerId: string, phones: string[]) {
  return prisma.order.updateMany({
    where: { customerPhone: { in: phones }, customerId: null },
    data: { customerId },
  });
}

export async function listCustomers() {
  const customers = await prisma.customer.findMany({
    include: { phones: true, _count: { select: { orders: true } } },
    orderBy: { name: "asc" },
  });

  const sales = await prisma.sale.findMany({
    where: { order: { customerId: { not: null } } },
    select: { totalAmount: true, order: { select: { customerId: true } } },
  });

  const totalSpentByCustomer = new Map<string, number>();
  for (const sale of sales) {
    const customerId = sale.order.customerId!;
    totalSpentByCustomer.set(customerId, (totalSpentByCustomer.get(customerId) ?? 0) + Number(sale.totalAmount));
  }

  return customers.map(({ _count, ...customer }) => ({
    ...customer,
    orderCount: _count.orders,
    totalSpent: totalSpentByCustomer.get(customer.id) ?? 0,
  }));
}

export async function createCustomer(input: CustomerPhonesInput) {
  const phones = dedupePhones(input.phones);
  if (phones.length === 0) throw new HttpError(400, "Agregá al menos un número de teléfono");

  await assertPhonesAvailable(phones);

  const customer = await prisma.customer.create({
    data: {
      name: input.name.trim(),
      notes: input.notes?.trim() || null,
      phones: { create: phones.map((phone) => ({ phone })) },
    },
    include: { phones: true },
  });

  await backfillOrders(customer.id, phones);

  return customer;
}

export async function updateCustomer(id: string, input: UpdateCustomerInput) {
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) throw new HttpError(404, "Cliente no encontrado");

  if (input.phones) {
    const phones = dedupePhones(input.phones);
    if (phones.length === 0) throw new HttpError(400, "Agregá al menos un número de teléfono");

    await assertPhonesAvailable(phones, id);

    await prisma.customerPhone.deleteMany({ where: { customerId: id } });
    await prisma.customerPhone.createMany({ data: phones.map((phone) => ({ phone, customerId: id })) });
    await backfillOrders(id, phones);
  }

  return prisma.customer.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
    },
    include: { phones: true },
  });
}

export async function deleteCustomer(id: string) {
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) throw new HttpError(404, "Cliente no encontrado");
  await prisma.customer.delete({ where: { id } });
}

/** Full profile for the customer detail view: contact info + spend/product/payment breakdown. */
export async function getCustomerDetail(id: string) {
  const customer = await prisma.customer.findUnique({ where: { id }, include: { phones: true } });
  if (!customer) throw new HttpError(404, "Cliente no encontrado");

  const orders = await prisma.order.findMany({
    where: { customerId: id },
    include: { items: { include: { product: true } }, sale: true },
    orderBy: { receivedAt: "desc" },
  });

  const delivered = orders.filter((order) => order.status === "DELIVERED");
  const cancelled = orders.filter((order) => order.status === "CANCELLED");
  const totalSpent = delivered.reduce((sum, order) => sum + Number(order.sale?.totalAmount ?? 0), 0);

  const byProductMap = new Map<string, { productName: string; quantity: number }>();
  for (const order of delivered) {
    for (const item of order.items) {
      if (!item.matched) continue;
      const key = item.productId ?? item.rawFragment;
      const existing = byProductMap.get(key) ?? {
        productName: item.product?.name ?? item.rawFragment,
        quantity: 0,
      };
      existing.quantity += item.quantity;
      byProductMap.set(key, existing);
    }
  }

  const byPaymentMethodMap = new Map<string, number>();
  for (const order of delivered) {
    const key = order.sale?.paymentMethod ?? "SIN_ESPECIFICAR";
    byPaymentMethodMap.set(key, (byPaymentMethodMap.get(key) ?? 0) + Number(order.sale?.totalAmount ?? 0));
  }

  const pendingDebt = delivered
    .filter((order) => order.sale?.paymentMethod === "DEBT" && !order.sale.debtSettledAt)
    .reduce((sum, order) => sum + Number(order.sale!.totalAmount), 0);

  return {
    customer,
    summary: {
      orderCount: orders.length,
      deliveredCount: delivered.length,
      cancelledCount: cancelled.length,
      totalSpent,
      pendingDebt,
      lastOrderAt: orders[0]?.receivedAt ?? null,
      byProduct: Array.from(byProductMap.values()).sort((a, b) => b.quantity - a.quantity),
      byPaymentMethod: Array.from(byPaymentMethodMap.entries()).map(([paymentMethod, revenue]) => ({
        paymentMethod,
        revenue,
      })),
    },
    orders,
  };
}
