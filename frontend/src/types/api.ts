export type OrderStatus = "PENDING" | "DELIVERED" | "CANCELLED";
export type PaymentMethod = "CASH" | "TRANSFER" | "DEBT";
export type DiscountType = "FIXED" | "PERCENTAGE";

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
  deliveryAddress: string | null;
  /** Set once the bot asked for the address; null again once the customer answers. */
  addressRequestedAt: string | null;
  customerId: string | null;
  /** Populated on the pending board and the history endpoints; null when not linked to a customer. */
  customer?: { name: string } | null;
  items: OrderItem[];
  /** Only present on history rows (from GET /orders/history); items omitted there. */
  sale?: Pick<
    Sale,
    "id" | "totalAmount" | "subtotalAmount" | "discountType" | "discountValue" | "paymentMethod" | "deliveredAt" | "debtSettledAt"
  > | null;
}

export interface CustomerPhone {
  id: string;
  customerId: string;
  phone: string;
}

/** Shape returned as-is by create/update — no aggregated stats (those only come from GET /customers). */
export interface CustomerRecord {
  id: string;
  name: string;
  notes: string | null;
  createdAt: string;
  phones: CustomerPhone[];
}

export interface Customer extends CustomerRecord {
  orderCount: number;
  totalSpent: number;
}

export interface CustomerDetail {
  customer: CustomerRecord;
  summary: {
    orderCount: number;
    deliveredCount: number;
    cancelledCount: number;
    totalSpent: number;
    pendingDebt: number;
    lastOrderAt: string | null;
    byProduct: { productName: string; quantity: number }[];
    byPaymentMethod: { paymentMethod: string; revenue: number }[];
  };
  orders: Order[];
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
  subtotalAmount: string | null;
  discountType: DiscountType | null;
  discountValue: string | null;
  paymentMethod: PaymentMethod | null;
  /** Only meaningful when paymentMethod is DEBT. Null while still unpaid. */
  debtSettledAt: string | null;
  items: SaleItem[];
}

export interface SalesMetrics {
  totalRevenue: number;
  byProduct: { productId: string | null; productName: string; quantity: number; revenue: number }[];
  byPeriod: { period: string; revenue: number }[];
  byPaymentMethod: { paymentMethod: string; revenue: number }[];
  topCustomersByQuantity: { customerId: string; customerName: string; quantity: number; revenue: number }[];
  topCustomersByRevenue: { customerId: string; customerName: string; quantity: number; revenue: number }[];
}
