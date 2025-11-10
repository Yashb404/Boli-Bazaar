//TODO: Test the logic once prisma is online
import prisma from "../prisma";
import {
	getCurrentLowestBid,
	isAuctionActive,
	calculateMinNextBid,
} from "./auction-service";

const DEFAULT_MIN_BID_DECREMENT = 50;

type ValidatedBidContext = {
	order: {
		id: number;
		status: string;
		auction_ends_at: Date | string;
	};
	supplier: { user_id: string; verification_status: string };
	lowestBid: Awaited<ReturnType<typeof getCurrentLowestBid>>;
	minNextBid: number | null;
};

export async function validateBid(
	pooledOrderId: number,
	price: number,
	supplierId: string,
	minBidDecrement: number = DEFAULT_MIN_BID_DECREMENT
): Promise<ValidatedBidContext> {
	if (!Number.isFinite(price) || price <= 0) {
		throw new Error("Bid price must be a positive number");
	}

	const order = await prisma.pooledOrder.findUnique({
		where: { id: pooledOrderId },
		select: {
			id: true,
			status: true,
			auction_ends_at: true,
		},
	});

	if (!order) {
		throw new Error("Pooled order not found");
	}

	if (!isAuctionActive(order)) {
		throw new Error("Auction is not currently accepting bids");
	}

	const supplier = await prisma.supplier.findUnique({
		where: { user_id: supplierId },
		select: {
			user_id: true,
			verification_status: true,
		},
	});

	if (!supplier) {
		throw new Error("Supplier not found");
	}

	if (supplier.verification_status !== "VERIFIED") {
		throw new Error("Supplier must be verified to place bids");
	}

	const lowestBid = await getCurrentLowestBid(pooledOrderId);
	const minNextBid = await calculateMinNextBid(pooledOrderId, minBidDecrement);

	if (lowestBid) {
		const lowestValue = Number(lowestBid.price_per_unit);
		// Check minimum decrement requirement first (more specific error)
		if (minNextBid !== null && price > minNextBid) {
			throw new Error(
				`Bid must be at least ₹${minBidDecrement} lower than the current lowest bid (₹${lowestValue.toFixed(2)})`
			);
		}
		// Fallback: ensure bid is lower than current lowest
		if (price >= lowestValue) {
			throw new Error(`Bid must be lower than the current lowest bid (₹${lowestValue.toFixed(2)})`);
		}
	}
	// If no bids exist yet, any positive price is acceptable

	return { order, supplier, lowestBid, minNextBid };
}

export async function submitBid(
	pooledOrderId: number,
	supplierId: string,
	price: number,
	notes?: string,
	minBidDecrement: number = DEFAULT_MIN_BID_DECREMENT
) {
	await validateBid(pooledOrderId, price, supplierId, minBidDecrement);

	return prisma.bid.create({
		data: {
			pooled_order_id: pooledOrderId,
			supplier_id: supplierId,
			price_per_unit: price,
			notes,
		},
	});
}

type SupplierBidStatus = "WINNING" | "OUTBID" | "AWARDED";

export async function getSupplierBidStatus(bidId: number) {
	const bid = await prisma.bid.findUnique({
		where: { id: bidId },
		include: {
			pooledOrder: {
				select: {
					id: true,
					status: true,
					winning_bid_id: true,
				},
			},
		},
	});

	if (!bid || !bid.pooledOrder) {
		throw new Error("Bid not found");
	}

	const { pooledOrder } = bid;

	let status: SupplierBidStatus = "OUTBID";

	if (pooledOrder.winning_bid_id && pooledOrder.winning_bid_id === bid.id) {
		status = "AWARDED";
	} else {
		const lowestBid = await getCurrentLowestBid(pooledOrder.id);
		if (lowestBid && lowestBid.id === bid.id) {
			status = "WINNING";
		}
	}

	return {
		status,
		isWinning: status === "WINNING" || status === "AWARDED",
		bid,
	};
}


