import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/errorHandler.js";
import * as customersService from "./customers.service.js";

export const customersRouter = Router();

const createCustomerSchema = z.object({
  name: z.string().trim().min(1),
  notes: z.string().trim().optional().nullable(),
  phones: z.array(z.string().trim().min(1)).min(1),
});

const updateCustomerSchema = z.object({
  name: z.string().trim().min(1).optional(),
  notes: z.string().trim().optional().nullable(),
  phones: z.array(z.string().trim().min(1)).min(1).optional(),
});

customersRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(await customersService.listCustomers());
  }),
);

customersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = createCustomerSchema.parse(req.body);
    res.status(201).json(await customersService.createCustomer(data));
  }),
);

customersRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json(await customersService.getCustomerDetail(req.params.id));
  }),
);

customersRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = updateCustomerSchema.parse(req.body);
    res.json(await customersService.updateCustomer(req.params.id, data));
  }),
);

customersRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await customersService.deleteCustomer(req.params.id);
    res.status(204).end();
  }),
);
