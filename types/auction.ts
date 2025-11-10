// Shared status string literals copied from UI usage to avoid Prisma dependency in the client
export type OrderStatus =
	| "PREPARING"
	| "AUCTION_OPEN"
	| "AUCTION_CLOSED"
	| "AWARDED"
	| "COMPLETED"
	| "CANCELLED";

export type ItemStatus =
	| "COMMITTED"
	| "DEPOSIT_PAID"
	| "DELIVERED"
	| "CANCELLED";

export type VerificationStatus = "PENDING" | "VERIFIED" | "REJECTED";

// Supplier metadata shown alongside bids
export type SupplierInfo = {
	user_id: string;
	business_name: string;
	verification_status: VerificationStatus;
	overall_rating: number;
	user: {
		full_name: string | null;
		phone_number: string | null;
		email?: string | null;
	};
};

// Bid details with supplier context for auction tables/timelines
export type BidWithSupplier = {
	id: number;
	price_per_unit: number;
	notes: string | null;
	created_at: string;
	supplier: SupplierInfo;
};

// Product summary used across supplier/vendor order views
export type ProductSummary = {
	id: number;
	name: string;
	grade: string | null;
	unit: string;
	description: string | null;
	image_url: string | null;
};

// Geographic grouping for pooled orders
export type AreaGroupSummary = {
	id: number;
	area_name: string;
	city: {
		id: number;
		name: string;
	};
};

// Reverse auction pooled order with the minimal related data needed by clients
export type PooledOrderWithDetails = {
	id: number;
	status: OrderStatus;
	auction_ends_at: string;
	final_price_per_unit: number | null;
	total_quantity_committed: number;
	areaGroup: AreaGroupSummary;
	product: ProductSummary;
	bids: BidWithSupplier[];
	winning_bid_id: number | null;
};

// Minimal order item (vendor view) reused for client hydration
export type VendorOrderItem = {
	id: number;
	quantity_committed: number;
	status: ItemStatus;
	pooledOrder: {
		id: number;
		status: OrderStatus;
		final_price_per_unit: number | null;
		product: Pick<ProductSummary, "name" | "unit">;
	};
};

export type SupplierBidStatus = "WINNING" | "OUTBID" | "AWARDED";

// API contracts
export type GetPooledOrdersResponse = {
	pooled_orders: PooledOrderWithDetails[];
};

export type GetPooledOrderResponse = {
	pooled_order: PooledOrderWithDetails;
};

export type SubmitBidRequest = {
	pooled_order_id: number;
	supplier_id: string;
	price_per_unit: number;
	notes?: string;
};

export type SubmitBidResponse = {
	success: boolean;
	message?: string;
	bid?: BidWithSupplier;
};

export type SupplierBidStatusResponse = {
	bid_id: number;
	status: SupplierBidStatus;
	is_winning: boolean;
};


