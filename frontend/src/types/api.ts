export type OrderStatus = "PENDING" | "DELIVERED" | "CANCELLED";
export type PaymentMethod = "CASH" | "TRANSFER";

export interface Product {
  id: string;
  name: string;
  weightKg: number;
  price: string;
  active: boolean;
  aliases?: ProductAlias[];
}

export interface ProductAlias {
  id: string;
  productId: string;
  alias: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string | null;
  product: Product | null;
  rawFragment: string;
  quantity: number;
  matched: boolean;
}

export interface Order {
  id: string;
  customerPhone: string;
  rawMessage: string;
  receivedAt: string;
  status: OrderStatus;
  botAnswered: boolean;
  botAnswerError: string | null;
  /** null for orders entered manually (no WhatsApp message behind them). */
  waMessageId: string | null;
  deliveredAt: string | null;
  items: OrderItem[];
  /** Only present on history rows (from GET /orders/history); items omitted there. */
  sale?: Pick<Sale, "id" | "totalAmount" | "paymentMethod" | "deliveredAt"> | null;
}

export interface SaleItem {
  id: string;
  productId: string | null;
  productNameSnapshot: string;
  quantity: number;
  unitPriceSnapshot: string;
  lineTotal: string;
}

export interface Sale {
  id: string;
  orderId: string;
  deliveredAt: string;
  totalAmount: string;
  paymentMethod: PaymentMethod | null;
  items: SaleItem[];
}

export interface SalesMetrics {
  totalRevenue: number;
  byProduct: { productId: string | null; productName: string; quantity: number; revenue: number }[];
  byPeriod: { period: string; revenue: number }[];
  byPaymentMethod: { paymentMethod: string; revenue: number }[];
}
