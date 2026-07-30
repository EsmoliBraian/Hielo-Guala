import cors from "cors";
import express from "express";
import { errorHandler } from "./middleware/errorHandler.js";
import { aliasesRouter } from "./modules/aliases/aliases.routes.js";
import { ordersRouter } from "./modules/orders/orders.routes.js";
import { productsRouter } from "./modules/products/products.routes.js";
import { salesRouter } from "./modules/sales/sales.routes.js";
import { whatsappRouter } from "./modules/whatsapp/whatsapp.routes.js";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  app.use("/api/orders", ordersRouter);
  app.use("/api/products", productsRouter);
  app.use("/api/sales", salesRouter);
  app.use("/api/whatsapp", whatsappRouter);
  app.use("/api", aliasesRouter);

  app.use(errorHandler);

  return app;
}
