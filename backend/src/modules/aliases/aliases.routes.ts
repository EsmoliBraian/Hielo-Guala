import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/errorHandler.js";
import * as aliasesService from "./aliases.service.js";

export const aliasesRouter = Router();

const createAliasSchema = z.object({
  productId: z.string().min(1),
  alias: z.string().min(1),
});

aliasesRouter.get(
  "/products/:productId/aliases",
  asyncHandler(async (req, res) => {
    res.json(await aliasesService.listAliasesForProduct(req.params.productId));
  }),
);

aliasesRouter.post(
  "/aliases",
  asyncHandler(async (req, res) => {
    const { productId, alias } = createAliasSchema.parse(req.body);
    res.status(201).json(await aliasesService.createAlias(productId, alias));
  }),
);

aliasesRouter.delete(
  "/aliases/:id",
  asyncHandler(async (req, res) => {
    await aliasesService.deleteAlias(req.params.id);
    res.status(204).send();
  }),
);
