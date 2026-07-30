import { OrderStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { asyncHandler, HttpError } from "../../middleware/errorHandler.js";
import * as ordersService from "./orders.service.js";

export const ordersRouter = Router();

const statusQuerySchema = z.nativeEnum(OrderStatus).default(OrderStatus.PENDING);

ordersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const status = statusQuerySchema.parse(req.query.status ?? OrderStatus.PENDING);
    res.json(await ordersService.listOrders(status));
  }),
);

ordersRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const order = await ordersService.getOrder(req.params.id);
    if (!order) throw new HttpError(404, "Pedido no encontrado");
    res.json(order);
  }),
);

ordersRouter.patch(
  "/:id/deliver",
  asyncHandler(async (req, res) => {
    res.json(await ordersService.deliverOrder(req.params.id));
  }),
);
