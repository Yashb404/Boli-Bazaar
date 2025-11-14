//getCurrentLowestBid(pooledOrderId) - Get lowest bid for an order
//isAuctionActive(pooledOrder) - Check if auction is open and not expired
//calculateMinNextBid(pooledOrderId, minDecrement) - Calculate minimum acceptable bid
//awardAuction(pooledOrderId) - Find lowest bid and award order

import prisma from "../prisma";

export async function getCurrentLowestBid(pooledOrderId: number) {
	// Lowest bid by price for the pooled order
	return prisma.bid.findFirst({
		where: { pooled_order_id: pooledOrderId },
		orderBy: { price_per_unit: "asc" },
	});
}

export function isAuctionActive(pooledOrder: { status: string; auction_ends_at: Date | string }) {
	const now = new Date();
	return (
		pooledOrder.status === "AUCTION_OPEN" &&
		now < new Date(pooledOrder.auction_ends_at)
	);
}

export async function calculateMinNextBid(
	pooledOrderId: number,
	minDecrement: number
) {
	const lowest = await getCurrentLowestBid(pooledOrderId);
	if (!lowest) {
		// No bids yet; without a starting price in schema, caller must decide opening bid.
		return null;
	}

	const lowestNum = Number(lowest.price_per_unit);
	const candidate = Math.max(0, lowestNum - Number(minDecrement));
	const rounded = Math.round(candidate * 100) / 100;

	return rounded; // return number with 2-decimal precision
}

export async function awardAuction(pooledOrderId: number) {
	return prisma.$transaction(async (tx: any) => {
		const order = await tx.pooledOrder.findUnique({
			where: { id: pooledOrderId },
		});
		if (!order) {
			throw new Error("Pooled order not found");
		}

		// Prevent awarding while auction is still active
		if (isAuctionActive(order)) {
			throw new Error("Auction is still active; cannot award yet");
		}

		// Find the lowest bid
		const lowest = await tx.bid.findFirst({
			where: { pooled_order_id: pooledOrderId },
			orderBy: { price_per_unit: "asc" },
		});

		// If no bids, simply close the auction if not already
		if (!lowest) {
			// If it was open, mark closed; otherwise keep status as is
			if (order.status === "AUCTION_OPEN") {
				return tx.pooledOrder.update({
					where: { id: pooledOrderId },
					data: { status: "AUCTION_CLOSED" },
				});
			}
			return order;
		}

		// Award to lowest bidder
		const updated = await tx.pooledOrder.update({
			where: { id: pooledOrderId },
			data: {
				winning_bid_id: lowest.id,
				final_price_per_unit: lowest.price_per_unit,
				status: "AWARDED",
			},
		});

		return updated;
	});
}
