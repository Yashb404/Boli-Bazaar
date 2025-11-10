import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { successResponse, errorResponse, notFoundResponse, serverErrorResponse } from "@/lib/utils/api-response";
import type { BidWithSupplier } from "@/types/auction";

export async function GET(
	request: NextRequest,
	{ params }: { params: { id: string } }
) {
	try {
		const id = parseInt(params.id);
		if (isNaN(id)) {
			return errorResponse("INVALID_ID", "Invalid pooled order ID", 400);
		}

		// Check if pooled order exists
		const pooledOrder = await prisma.pooledOrder.findUnique({
			where: { id },
			select: { id: true },
		});

		if (!pooledOrder) {
			return notFoundResponse("Pooled order not found");
		}

		// Fetch all bids for this order
		const bids = await prisma.bid.findMany({
			where: { pooled_order_id: id },
			include: {
				supplier: {
					include: {
						user: {
							select: {
								full_name: true,
								phone_number: true,
								email: true,
							},
						},
					},
				},
			},
			orderBy: {
				price_per_unit: "asc", // Lowest first
			},
		});

		const transformedBids: BidWithSupplier[] = bids.map((bid: any) => ({
			id: bid.id,
			price_per_unit: Number(bid.price_per_unit),
			notes: bid.notes,
			created_at: bid.created_at.toISOString(),
			supplier: {
				user_id: bid.supplier.user_id,
				business_name: bid.supplier.business_name,
				verification_status: bid.supplier.verification_status as any,
				overall_rating: Number(bid.supplier.overall_rating),
				user: {
					full_name: bid.supplier.user.full_name,
					phone_number: bid.supplier.user.phone_number,
					email: bid.supplier.user.email,
				},
			},
		}));

		return successResponse({
			bids: transformedBids,
			total: transformedBids.length,
		});
	} catch (error: any) {
		console.error("Error fetching bids:", error);
		return serverErrorResponse("Failed to fetch bids");
	}
}

