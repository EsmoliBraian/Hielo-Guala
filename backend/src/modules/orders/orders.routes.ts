import { DiscountType, OrderStatus, PaymentMethod } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { asyncHandler, HttpError } from "../../middleware/errorHandler.js";
import * as ordersService from "./orders.service.js";

export const ordersRouter = Router();

const statusQuerySchema = z.nativeEnum(OrderStatus).default(OrderStatus.PENDING);

const deliverOrderSchema = z.object({
  paymentMethod: z.nativeEnum(PaymentMethod),
  discount: z
    .object({
      type: z.nativeEnum(DiscountType),
      value: z.number().positive(),
    })
    .optional()
    .nullable(),
  customerId: z.string().min(1).optional().nullable(),
});

const assignCustomerSchema = z.object({
  customerId: z.string().min(1),
});

const createManualOrderSchema = z.object({
  customerId: z.string().min(1).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
});

const historyQuerySchema = z.object({
  days: z.coerce.number().int().positive().max(365).default(7),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido")
    .optional(),
  customerId: z.string().optional(),
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

// Must come before "/:id" — otherwise Express matches "history" as an :id.
ordersRouter.get(
  "/history",
  asyncHandler(async (req, res) => {
    const { days, date, customerId } = historyQuerySchema.parse(req.query);
    res.json(await ordersService.listOrderHistory({ days, date, customerId }));
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
    const data = deliverOrderSchema.parse(req.body);
    res.json(await ordersService.deliverOrder(req.params.id, data));
  }),
);

ordersRouter.patch(
  "/:id/cancel",
  asyncHandler(async (req, res) => {
    res.json(await ordersService.cancelOrder(req.params.id));
  }),
);

ordersRouter.patch(
  "/:id/customer",
  asyncHandler(async (req, res) => {
    const { customerId } = assignCustomerSchema.parse(req.body);
    res.json(await ordersService.assignCustomer(req.params.id, customerId));
  }),
);

ordersRouter.patch(
  "/:id/settle-debt",
  asyncHandler(async (req, res) => {
    res.json(await ordersService.settleDebt(req.params.id));
  }),
);
