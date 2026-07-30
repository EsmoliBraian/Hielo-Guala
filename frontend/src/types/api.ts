export type OrderStatus = "PENDING" | "DELIVERED" | "CANCELLED";

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
  deliveredAt: string | null;
  items: OrderItem[];
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
  items: SaleItem[];
}

export interface SalesMetrics {
  totalRevenue: number;
  byProduct: { productId: string | null; productName: string; quantity: number; revenue: number }[];
  byPeriod: { period: string; revenue: number }[];
}
