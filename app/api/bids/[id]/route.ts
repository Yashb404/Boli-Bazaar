import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { successResponse, errorResponse, notFoundResponse, serverErrorResponse, forbiddenResponse, conflictResponse } from "@/lib/utils/api-response";
import { isAuctionActive } from "@/lib/services/auction-service";
import type { BidWithSupplier } from "@/types/auction";

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> | { id: string } }
) {
	try {
		// Handle both sync and async params (Next.js 15+ uses async params)
		const resolvedParams = await Promise.resolve(params);
		const id = parseInt(resolvedParams.id);
		if (isNaN(id)) {
			return errorResponse("INVALID_ID", "Invalid bid ID", 400);
		}

		const bid = await prisma.bid.findUnique({
			where: { id },
			include: {
				pooledOrder: {
					select: {
						id: true,
						status: true,
						auction_ends_at: true,
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
		});

		if (!bid) {
			return notFoundResponse("Bid not found");
		}

		const transformedBid: BidWithSupplier = {
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
		};

		return successResponse({
			bid: transformedBid,
			pooled_order: {
				id: bid.pooledOrder.id,
				status: bid.pooledOrder.status,
				auction_ends_at: bid.pooledOrder.auction_ends_at.toISOString(),
			},
		});
	} catch (error: any) {
		console.error("Error fetching bid:", error);
		return serverErrorResponse("Failed to fetch bid");
	}
}

export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> | { id: string } }
) {
	try {
		// Handle both sync and async params (Next.js 15+ uses async params)
		const resolvedParams = await Promise.resolve(params);
		const id = parseInt(resolvedParams.id);
		if (isNaN(id)) {
			return errorResponse("INVALID_ID", "Invalid bid ID", 400);
		}

		// Get bid with pooled order to check auction status
		const bid = await prisma.bid.findUnique({
			where: { id },
			include: {
				pooledOrder: {
					select: {
						id: true,
						status: true,
						auction_ends_at: true,
					},
				},
			},
		});

		if (!bid) {
			return notFoundResponse("Bid not found");
		}

		// Check if auction is still active (can only cancel if auction is open)
		if (!isAuctionActive(bid.pooledOrder)) {
			return conflictResponse("Cannot cancel bid: auction is no longer active");
		}

		// TODO: Add authorization check once auth is integrated
		// For now, allow cancellation if auction is active
		// const supplierId = request.headers.get('x-supplier-id');
		// if (bid.supplier_id !== supplierId) {
		//   return forbiddenResponse("You can only cancel your own bids");
		// }

		// Delete the bid
		await prisma.bid.delete({
			where: { id },
		});

		return successResponse(
			{ bid_id: id },
			"Bid cancelled successfully"
		);
	} catch (error: any) {
		console.error("Error cancelling bid:", error);
		return serverErrorResponse("Failed to cancel bid");
	}
}

