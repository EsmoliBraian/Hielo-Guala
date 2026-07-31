import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/errorHandler.js";
import * as ordersService from "../orders/orders.service.js";

export const whatsappRouter = Router();

const incomingOrderSchema = z.object({
  customerPhone: z.string().min(1),
  rawMessage: z.string().min(1),
  waMessageId: z.string().min(1),
  receivedAt: z.string().datetime(),
});

const botAnsweredSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
});

/** Called by the n8n workflow for every incoming WhatsApp message. */
whatsappRouter.post(
  "/orders",
  asyncHandler(async (req, res) => {
    const data = incomingOrderSchema.parse(req.body);
    const { order, replyText, addressCaptured } = await ordersService.createOrderFromWhatsapp(data);
    const unmatchedCount = order.items.filter((item) => !item.matched).length;

    res.status(201).json({
      orderId: order.id,
      items: order.items,
      unmatchedCount,
      replyText,
      addressCaptured,
    });
  }),
);

/** Called by n8n after it attempts to send the WhatsApp confirmation reply. */
whatsappRouter.post(
  "/orders/:orderId/bot-answered",
  asyncHandler(async (req, res) => {
    const { success, error } = botAnsweredSchema.parse(req.body);
    res.json(await ordersService.markBotAnswered(req.params.orderId, success, error));
  }),
);
