import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { successResponse, errorResponse, notFoundResponse, serverErrorResponse } from "@/lib/utils/api-response";
import { getCurrentLowestBid } from "@/lib/services/auction-service";
import type { PooledOrderWithDetails } from "@/types/auction";

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> | { id: string } }
) {
	try {
		// Handle both sync and async params (Next.js 15+ uses async params)
		const resolvedParams = await Promise.resolve(params);
		const id = parseInt(resolvedParams.id);
		if (isNaN(id)) {
			return errorResponse("INVALID_ID", "Invalid pooled order ID", 400);
		}

		const pooledOrder = await prisma.pooledOrder.findUnique({
			where: { id },
			include: {
				product: true,
				areaGroup: {
					include: {
						city: {
							select: {
								id: true,
								name: true,
							},
						},
					},
				},
				Bids: {
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
						price_per_unit: "asc",
					},
				},
			},
		});

		if (!pooledOrder) {
			return notFoundResponse("Pooled order not found");
		}

		const lowestBid = await getCurrentLowestBid(pooledOrder.id);

		const transformedOrder: PooledOrderWithDetails = {
			id: pooledOrder.id,
			status: pooledOrder.status as any,
			auction_ends_at: pooledOrder.auction_ends_at.toISOString(),
			final_price_per_unit: pooledOrder.final_price_per_unit ? Number(pooledOrder.final_price_per_unit) : null,
			total_quantity_committed: Number(pooledOrder.total_quantity_committed),
			areaGroup: {
				id: pooledOrder.areaGroup.id,
				area_name: pooledOrder.areaGroup.area_name,
				city: {
					id: pooledOrder.areaGroup.city.id,
					name: pooledOrder.areaGroup.city.name,
				},
			},
			product: {
				id: pooledOrder.product.id,
				name: pooledOrder.product.name,
				grade: pooledOrder.product.grade,
				unit: pooledOrder.product.unit,
				description: pooledOrder.product.description,
				image_url: pooledOrder.product.image_url,
			},
			bids: pooledOrder.Bids.map((bid: { id: any; price_per_unit: any; notes: any; created_at: { toISOString: () => any; }; supplier: { user_id: any; business_name: any; verification_status: any; overall_rating: any; user: { full_name: any; phone_number: any; email: any; }; }; }) => ({
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
			})),
			winning_bid_id: pooledOrder.winning_bid_id,
		};

		return successResponse({
			pooled_order: transformedOrder,
			current_lowest_bid: lowestBid ? Number(lowestBid.price_per_unit) : null,
		});
	} catch (error: any) {
		console.error("Error fetching pooled order:", error);
		return serverErrorResponse("Failed to fetch pooled order");
	}
}

