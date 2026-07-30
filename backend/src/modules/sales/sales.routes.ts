import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/errorHandler.js";
import * as salesService from "./sales.service.js";

export const salesRouter = Router();

const rangeQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

const metricsQuerySchema = rangeQuerySchema.extend({
  groupBy: z.enum(["day", "week"]).default("day"),
});

salesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { from, to } = rangeQuerySchema.parse(req.query);
    res.json(
      await salesService.listSales({
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
      }),
    );
  }),
);

salesRouter.get(
  "/metrics",
  asyncHandler(async (req, res) => {
    const { from, to, groupBy } = metricsQuerySchema.parse(req.query);
    res.json(
      await salesService.getSalesMetrics({
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
        groupBy,
      }),
    );
  }),
);
