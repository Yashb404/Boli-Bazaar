import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { successResponse, errorResponse, serverErrorResponse } from "@/lib/utils/api-response";
import { getCurrentLowestBid, isAuctionActive } from "@/lib/services/auction-service";
import { getSupplierBidStatus } from "@/lib/services/bid-service";
import type { BidWithSupplier, SupplierBidStatus } from "@/types/auction";

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const supplierId = searchParams.get("supplier_id");

		if (!supplierId) {
			return errorResponse("MISSING_SUPPLIER_ID", "supplier_id query parameter is required", 400);
		}

		// Verify supplier exists
		const supplier = await prisma.supplier.findUnique({
			where: { user_id: supplierId },
			select: { user_id: true },
		});

		if (!supplier) {
			return errorResponse("SUPPLIER_NOT_FOUND", "Supplier not found", 404);
		}

		// Fetch all bids for this supplier
		const bids = await prisma.bid.findMany({
			where: { supplier_id: supplierId },
			include: {
				pooledOrder: {
					include: {
						product: {
							select: {
								id: true,
								name: true,
								grade: true,
								unit: true,
								description: true,
								image_url: true,
							},
						},
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
					},
				},
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
				created_at: "desc",
			},
		});

		// Transform bids and determine status for each
		const bidsWithStatus = await Promise.all(
			bids.map(async (bid: { id: number; pooledOrder: { id?: any; winning_bid_id?: any; status: any; auction_ends_at: any; total_quantity_committed?: any; final_price_per_unit?: any; product?: any; areaGroup?: any; }; price_per_unit: any; notes: any; created_at: { toISOString: () => any; }; supplier: { user_id: any; business_name: any; verification_status: any; overall_rating: any; user: { full_name: any; phone_number: any; email: any; }; }; }) => {
				// Get bid status
				let status: SupplierBidStatus = "OUTBID";
				let isWinning = false;

				try {
					const bidStatus = await getSupplierBidStatus(bid.id);
					status = bidStatus.status;
					isWinning = bidStatus.isWinning;
				} catch (error) {
					// If bid status can't be determined, check manually
					const lowestBid = await getCurrentLowestBid(bid.pooledOrder.id);
					if (lowestBid && lowestBid.id === bid.id) {
						if (bid.pooledOrder.winning_bid_id === bid.id) {
							status = "AWARDED";
							isWinning = true;
						} else {
							status = "WINNING";
							isWinning = true;
						}
					} else if (bid.pooledOrder.winning_bid_id === bid.id) {
						status = "AWARDED";
						isWinning = true;
					}
				}

				const isAuctionStillActive = isAuctionActive(bid.pooledOrder);

				return {
					bid: {
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
					} as BidWithSupplier,
					pooled_order: {
						id: bid.pooledOrder.id,
						status: bid.pooledOrder.status,
						auction_ends_at: bid.pooledOrder.auction_ends_at.toISOString(),
						total_quantity_committed: Number(bid.pooledOrder.total_quantity_committed),
						final_price_per_unit: bid.pooledOrder.final_price_per_unit
							? Number(bid.pooledOrder.final_price_per_unit)
							: null,
						product: {
							id: bid.pooledOrder.product.id,
							name: bid.pooledOrder.product.name,
							grade: bid.pooledOrder.product.grade,
							unit: bid.pooledOrder.product.unit,
							description: bid.pooledOrder.product.description,
							image_url: bid.pooledOrder.product.image_url,
						},
						areaGroup: {
							id: bid.pooledOrder.areaGroup.id,
							area_name: bid.pooledOrder.areaGroup.area_name,
							city: {
								id: bid.pooledOrder.areaGroup.city.id,
								name: bid.pooledOrder.areaGroup.city.name,
							},
						},
					},
					status,
					is_winning: isWinning,
					is_auction_active: isAuctionStillActive,
					current_lowest_bid: (await getCurrentLowestBid(bid.pooledOrder.id))
						? Number((await getCurrentLowestBid(bid.pooledOrder.id))!.price_per_unit)
						: null,
				};
			})
		);

		return successResponse({
			bids: bidsWithStatus,
			total: bidsWithStatus.length,
		});
	} catch (error: any) {
		console.error("Error fetching supplier bids:", error);
		return serverErrorResponse("Failed to fetch supplier bids");
	}
}

