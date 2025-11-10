import { z } from "zod";

export const createPooledOrderSchema = z.object({
	area_group_id: z.number().int().positive(),
	product_id: z.number().int().positive(),
	auction_ends_at: z.string().datetime(), // ISO 8601 datetime string
});

export type CreatePooledOrderInput = z.infer<typeof createPooledOrderSchema>;

export const updatePooledOrderStatusSchema = z.object({
	status: z.enum(["PREPARING", "AUCTION_OPEN", "AUCTION_CLOSED", "AWARDED", "COMPLETED", "CANCELLED"]),
});

export type UpdatePooledOrderStatusInput = z.infer<typeof updatePooledOrderStatusSchema>;

export const getPooledOrdersQuerySchema = z.object({
	status: z.enum(["PREPARING", "AUCTION_OPEN", "AUCTION_CLOSED", "AWARDED", "COMPLETED", "CANCELLED"]).optional(),
	area_group_id: z.string().regex(/^\d+$/).transform(Number).optional(),
});

export type GetPooledOrdersQuery = z.infer<typeof getPooledOrdersQuerySchema>;

