import { prisma } from "../../lib/prisma.js";

interface DateRange {
  from?: Date;
  to?: Date;
}

type GroupBy = "day" | "week";

export function listSales({ from, to }: DateRange) {
  return prisma.sale.findMany({
    where: { deliveredAt: { gte: from, lte: to } },
    include: { items: true },
    orderBy: { deliveredAt: "desc" },
  });
}

function periodKey(date: Date, groupBy: GroupBy): string {
  if (groupBy === "day") return date.toISOString().slice(0, 10);

  const monday = new Date(date);
  const isoDayOffset = (monday.getUTCDay() + 6) % 7; // 0 = Monday
  monday.setUTCDate(monday.getUTCDate() - isoDayOffset);
  return monday.toISOString().slice(0, 10);
}

export async function getSalesMetrics({
  from,
  to,
  groupBy = "day",
}: DateRange & { groupBy?: GroupBy }) {
  const sales = await prisma.sale.findMany({
    where: { deliveredAt: { gte: from, lte: to } },
    include: { items: true },
  });

  const totalRevenue = sales.reduce((sum, sale) => sum + Number(sale.totalAmount), 0);

  const byProductMap = new Map<
    string,
    { productId: string | null; productName: string; quantity: number; revenue: number }
  >();
  for (const sale of sales) {
    for (const item of sale.items) {
      const key = item.productId ?? item.productNameSnapshot;
      const existing = byProductMap.get(key) ?? {
        productId: item.productId,
        productName: item.productNameSnapshot,
        quantity: 0,
        revenue: 0,
      };
      existing.quantity += item.quantity;
      existing.revenue += Number(item.lineTotal);
      byProductMap.set(key, existing);
    }
  }

  const byPeriodMap = new Map<string, number>();
  for (const sale of sales) {
    const key = periodKey(sale.deliveredAt, groupBy);
    byPeriodMap.set(key, (byPeriodMap.get(key) ?? 0) + Number(sale.totalAmount));
  }

  const byPaymentMethodMap = new Map<string, number>();
  for (const sale of sales) {
    const key = sale.paymentMethod ?? "SIN_ESPECIFICAR";
    byPaymentMethodMap.set(key, (byPaymentMethodMap.get(key) ?? 0) + Number(sale.totalAmount));
  }

  return {
    totalRevenue,
    byProduct: Array.from(byProductMap.values()),
    byPeriod: Array.from(byPeriodMap.entries())
      .map(([period, revenue]) => ({ period, revenue }))
      .sort((a, b) => a.period.localeCompare(b.period)),
    byPaymentMethod: Array.from(byPaymentMethodMap.entries()).map(([paymentMethod, revenue]) => ({
      paymentMethod,
      revenue,
    })),
  };
}
