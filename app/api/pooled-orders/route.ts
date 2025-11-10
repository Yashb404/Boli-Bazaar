import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { successResponse, errorResponse, serverErrorResponse } from "@/lib/utils/api-response";
import { getPooledOrdersQuerySchema } from "@/lib/validators/pooled-order";
import { getCurrentLowestBid } from "@/lib/services/auction-service";
import type { PooledOrderWithDetails } from "@/types/auction";

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const query = {
			status: searchParams.get("status") || undefined,
			area_group_id: searchParams.get("area_group_id") || undefined,
		};

		// Validate query parameters
		const validatedQuery = getPooledOrdersQuerySchema.parse(query);

		// Build where clause
		const where: any = {};
		if (validatedQuery.status) {
			where.status = validatedQuery.status;
		}
		if (validatedQuery.area_group_id) {
			where.area_group_id = validatedQuery.area_group_id;
		}

		// Fetch pooled orders with related data
		const pooledOrders = await prisma.pooledOrder.findMany({
			where,
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
			orderBy: {
				created_at: "desc",
			},
		});

		// Transform to match PooledOrderWithDetails type
		const transformedOrders: PooledOrderWithDetails[] = await Promise.all(
			pooledOrders.map(async (order: { id: number; status: any; auction_ends_at: { toISOString: () => any; }; final_price_per_unit: any; total_quantity_committed: any; areaGroup: { id: any; area_name: any; city: { id: any; name: any; }; }; product: { id: any; name: any; grade: any; unit: any; description: any; image_url: any; }; Bids: any[]; winning_bid_id: any; }) => {
				const lowestBid = await getCurrentLowestBid(order.id);

				return {
					id: order.id,
					status: order.status as any,
					auction_ends_at: order.auction_ends_at.toISOString(),
					final_price_per_unit: order.final_price_per_unit ? Number(order.final_price_per_unit) : null,
					total_quantity_committed: Number(order.total_quantity_committed),
					areaGroup: {
						id: order.areaGroup.id,
						area_name: order.areaGroup.area_name,
						city: {
							id: order.areaGroup.city.id,
							name: order.areaGroup.city.name,
						},
					},
					product: {
						id: order.product.id,
						name: order.product.name,
						grade: order.product.grade,
						unit: order.product.unit,
						description: order.product.description,
						image_url: order.product.image_url,
					},
					bids: order.Bids.map((bid) => ({
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
					winning_bid_id: order.winning_bid_id,
				};
			})
		);

		return successResponse({
			pooled_orders: transformedOrders,
		});
	} catch (error: any) {
		console.error("Error fetching pooled orders:", error);
		if (error.name === "ZodError") {
			return errorResponse("VALIDATION_ERROR", error.errors[0].message, 400);
		}
		return serverErrorResponse("Failed to fetch pooled orders");
	}
}

