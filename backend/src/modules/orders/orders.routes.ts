import { OrderStatus, PaymentMethod } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { asyncHandler, HttpError } from "../../middleware/errorHandler.js";
import * as ordersService from "./orders.service.js";

export const ordersRouter = Router();

const statusQuerySchema = z.nativeEnum(OrderStatus).default(OrderStatus.PENDING);

const deliverOrderSchema = z.object({
  paymentMethod: z.nativeEnum(PaymentMethod),
});

const createManualOrderSchema = z.object({
  customerPhone: z.string().trim().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
});

ordersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const status = statusQuerySchema.parse(req.query.status ?? OrderStatus.PENDING);
    res.json(await ordersService.listOrders(status));
  }),
);

ordersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = createManualOrderSchema.parse(req.body);
    res.status(201).json(await ordersService.createManualOrder(data));
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
    const { paymentMethod } = deliverOrderSchema.parse(req.body);
    res.json(await ordersService.deliverOrder(req.params.id, paymentMethod));
  }),
);
