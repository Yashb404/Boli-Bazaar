import { z } from "zod";

export const submitBidSchema = z.object({
	pooled_order_id: z.number().int().positive(),
	supplier_id: z.string().min(1),
	price_per_unit: z.number().positive().multipleOf(0.01), // Must be positive and have max 2 decimal places
	notes: z.string().optional().nullable(),
});

export type SubmitBidInput = z.infer<typeof submitBidSchema>;

export const cancelBidSchema = z.object({
	bid_id: z.number().int().positive(),
	supplier_id: z.string().min(1), // For authorization check
});

export type CancelBidInput = z.infer<typeof cancelBidSchema>;

