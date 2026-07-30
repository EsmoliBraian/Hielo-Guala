import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/errorHandler.js";
import * as productsService from "./products.service.js";

export const productsRouter = Router();

const createProductSchema = z.object({
  name: z.string().min(1),
  weightKg: z.number().int().positive(),
  price: z.number().nonnegative(),
});

const updateProductSchema = createProductSchema.partial().extend({
  active: z.boolean().optional(),
});

productsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const includeInactive = req.query.includeInactive === "true";
    res.json(await productsService.listProducts(includeInactive));
  }),
);

productsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = createProductSchema.parse(req.body);
    res.status(201).json(await productsService.createProduct(data));
  }),
);

productsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = updateProductSchema.parse(req.body);
    res.json(await productsService.updateProduct(req.params.id, data));
  }),
);

productsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json(await productsService.deactivateProduct(req.params.id));
  }),
);
