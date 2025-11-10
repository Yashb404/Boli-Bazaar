import prisma from "../lib/prisma";
import {
	submitBid,
	getSupplierBidStatus,
	validateBid,
} from "../lib/services/bid-service";
import {
	awardAuction,
	getCurrentLowestBid,
	isAuctionActive,
	calculateMinNextBid,
} from "../lib/services/auction-service";

// Test helpers
const TEST_DATA = {
	city: null as any,
	areaGroup: null as any,
	product: null as any,
	suppliers: [] as any[],
	pooledOrders: [] as any[],
};

// Cleanup function
async function cleanup() {
	console.log("\n🧹 Cleaning up test data...");
	try {
		// Delete in reverse order of dependencies
		await prisma.bid.deleteMany({});
		await prisma.pooledOrder.deleteMany({});
		await prisma.orderItem.deleteMany({});
		await prisma.transaction.deleteMany({});
		await prisma.supplier.deleteMany({});
		await prisma.vendor.deleteMany({});
		await prisma.user.deleteMany({});
		await prisma.product.deleteMany({});
		await prisma.areaGroup.deleteMany({});
		await prisma.city.deleteMany({});
		console.log("✅ Cleanup complete");
	} catch (error) {
		console.error("⚠️ Cleanup error:", error);
	}
}

// Setup test data
async function setupTestData() {
	console.log("📦 Setting up test data...");

	// Create city
	TEST_DATA.city = await prisma.city.create({
		data: {
			name: "Test City",
			map_center: [19.0760, 72.8777],
			default_zoom: 11,
		},
	});

	// Create area group
	TEST_DATA.areaGroup = await prisma.areaGroup.create({
		data: {
			area_name: "Test Area",
			city_id: TEST_DATA.city.id,
			location_center: [19.0760, 72.8777],
		},
	});

	// Create product
	TEST_DATA.product = await prisma.product.create({
		data: {
			name: "Test Tomatoes",
			grade: "A",
			unit: "kg",
			description: "Fresh test tomatoes",
		},
	});

	// Create verified suppliers
	for (let i = 1; i <= 3; i++) {
		const user = await prisma.user.create({
			data: {
				id: `test-supplier-${i}`,
				email: `supplier${i}@test.com`,
				role_type: "SUPPLIER",
				full_name: `Test Supplier ${i}`,
			},
		});

		const supplier = await prisma.supplier.create({
			data: {
				user_id: user.id,
				business_name: `Test Supplier Co ${i}`,
				verification_status: "VERIFIED",
			},
		});

		TEST_DATA.suppliers.push(supplier);
	}

	// Create unverified supplier
	const unverifiedUser = await prisma.user.create({
		data: {
			id: "test-supplier-unverified",
			email: "unverified@test.com",
			role_type: "SUPPLIER",
			full_name: "Unverified Supplier",
		},
	});

	const unverifiedSupplier = await prisma.supplier.create({
		data: {
			user_id: unverifiedUser.id,
			business_name: "Unverified Co",
			verification_status: "PENDING",
		},
	});

	TEST_DATA.suppliers.push(unverifiedSupplier);

	console.log("✅ Test data setup complete\n");
}

// Test suite 1: Basic bid submission
async function testBasicBidSubmission() {
	console.log("=".repeat(60));
	console.log("TEST SUITE 1: Basic Bid Submission");
	console.log("=".repeat(60));

	try {
		// Create an active auction
		const order = await prisma.pooledOrder.create({
			data: {
				area_group_id: TEST_DATA.areaGroup.id,
				product_id: TEST_DATA.product.id,
				total_quantity_committed: 100,
				status: "AUCTION_OPEN",
				auction_ends_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
			},
		});

		// Test 1.1: First bid (no existing bids)
		console.log("\n📝 Test 1.1: First bid submission");
		const firstBid = await submitBid(
			order.id,
			TEST_DATA.suppliers[0].user_id,
			500,
			"First bid"
		);
		console.log("✅ First bid submitted:", {
			id: firstBid.id,
			price: firstBid.price_per_unit,
		});

		// Test 1.2: Verify lowest bid
		const lowestBid = await getCurrentLowestBid(order.id);
		if (lowestBid?.id === firstBid.id) {
			console.log("✅ Lowest bid is correct");
		} else {
			throw new Error("Lowest bid mismatch");
		}

		// Test 1.3: Check bid status (should be winning)
		const bidStatus = await getSupplierBidStatus(firstBid.id);
		if (bidStatus.status === "WINNING" && bidStatus.isWinning) {
			console.log("✅ Bid status is WINNING");
		} else {
			throw new Error(`Expected WINNING, got ${bidStatus.status}`);
		}

		TEST_DATA.pooledOrders.push(order);
		console.log("✅ Test Suite 1 PASSED\n");
	} catch (error: any) {
		console.error("❌ Test Suite 1 FAILED:", error.message);
		throw error;
	}
}

// Test suite 2: Reverse auction logic (must be lower)
async function testReverseAuctionLogic() {
	console.log("=".repeat(60));
	console.log("TEST SUITE 2: Reverse Auction Logic");
	console.log("=".repeat(60));

	try {
		const order = await prisma.pooledOrder.create({
			data: {
				area_group_id: TEST_DATA.areaGroup.id,
				product_id: TEST_DATA.product.id,
				total_quantity_committed: 100,
				status: "AUCTION_OPEN",
				auction_ends_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
			},
		});

		// Initial bid: ₹500
		console.log("\n📝 Test 2.1: Initial bid at ₹500");
		const bid1 = await submitBid(order.id, TEST_DATA.suppliers[0].user_id, 500);
		console.log("✅ Initial bid submitted");

		// Test 2.2: Valid lower bid (₹450)
		console.log("\n📝 Test 2.2: Valid lower bid at ₹450");
		const bid2 = await submitBid(order.id, TEST_DATA.suppliers[1].user_id, 450);
		console.log("✅ Lower bid submitted");

		// Test 2.3: Verify new lowest bid
		const lowestBid = await getCurrentLowestBid(order.id);
		if (lowestBid?.id === bid2.id && Number(lowestBid.price_per_unit) === 450) {
			console.log("✅ Lowest bid updated correctly");
		} else {
			throw new Error("Lowest bid not updated");
		}

		// Test 2.4: Bid status - bid1 should be OUTBID, bid2 should be WINNING
		const status1 = await getSupplierBidStatus(bid1.id);
		const status2 = await getSupplierBidStatus(bid2.id);

		if (status1.status === "OUTBID" && !status1.isWinning) {
			console.log("✅ First bid correctly marked as OUTBID");
		} else {
			throw new Error(`Expected OUTBID for bid1, got ${status1.status}`);
		}

		if (status2.status === "WINNING" && status2.isWinning) {
			console.log("✅ Second bid correctly marked as WINNING");
		} else {
			throw new Error(`Expected WINNING for bid2, got ${status2.status}`);
		}

		// Test 2.5: Reject bid that's higher than current lowest
		console.log("\n📝 Test 2.5: Reject bid higher than current lowest (₹500)");
		try {
			await submitBid(order.id, TEST_DATA.suppliers[2].user_id, 500);
			throw new Error("Should have rejected bid higher than lowest");
		} catch (error: any) {
			if (error.message.includes("lower than the current lowest bid")) {
				console.log("✅ Correctly rejected higher bid");
			} else {
				throw error;
			}
		}

		// Test 2.6: Reject bid equal to current lowest
		console.log("\n📝 Test 2.6: Reject bid equal to current lowest (₹450)");
		try {
			await submitBid(order.id, TEST_DATA.suppliers[0].user_id, 450);
			throw new Error("Should have rejected bid equal to lowest");
		} catch (error: any) {
			if (error.message.includes("lower than the current lowest bid")) {
				console.log("✅ Correctly rejected equal bid");
			} else {
				throw error;
			}
		}

		TEST_DATA.pooledOrders.push(order);
		console.log("✅ Test Suite 2 PASSED\n");
	} catch (error: any) {
		console.error("❌ Test Suite 2 FAILED:", error.message);
		throw error;
	}
}

// Test suite 3: Minimum decrement validation
async function testMinimumDecrement() {
	console.log("=".repeat(60));
	console.log("TEST SUITE 3: Minimum Decrement Validation (₹50)");
	console.log("=".repeat(60));

	try {
		const order = await prisma.pooledOrder.create({
			data: {
				area_group_id: TEST_DATA.areaGroup.id,
				product_id: TEST_DATA.product.id,
				total_quantity_committed: 100,
				status: "AUCTION_OPEN",
				auction_ends_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
			},
		});

		// Initial bid: ₹500
		console.log("\n📝 Test 3.1: Initial bid at ₹500");
		await submitBid(order.id, TEST_DATA.suppliers[0].user_id, 500);
		console.log("✅ Initial bid submitted");

		// Test 3.2: Calculate minimum next bid
		const minNextBid = await calculateMinNextBid(order.id, 50);
		if (minNextBid === 450) {
			console.log(`✅ Minimum next bid calculated correctly: ₹${minNextBid}`);
		} else {
			throw new Error(`Expected ₹450, got ₹${minNextBid}`);
		}

		// Test 3.3: Accept bid with exact minimum decrement (₹450)
		console.log("\n📝 Test 3.3: Bid with exact minimum decrement (₹450)");
		const bid2 = await submitBid(order.id, TEST_DATA.suppliers[1].user_id, 450);
		console.log("✅ Bid with exact decrement accepted");

		// Test 3.4: Accept bid with more than minimum decrement (₹400)
		console.log("\n📝 Test 3.4: Bid with more than minimum decrement (₹400)");
		const bid3 = await submitBid(order.id, TEST_DATA.suppliers[2].user_id, 400);
		console.log("✅ Bid with larger decrement accepted");

		// Test 3.5: Reject bid that doesn't meet minimum decrement (₹460, only ₹40 lower)
		console.log("\n📝 Test 3.5: Reject bid that doesn't meet minimum decrement (₹460)");
		try {
			await submitBid(order.id, TEST_DATA.suppliers[0].user_id, 460);
			throw new Error("Should have rejected bid that doesn't meet minimum decrement");
		} catch (error: any) {
			if (error.message.includes("at least ₹50 lower")) {
				console.log("✅ Correctly rejected bid that doesn't meet minimum decrement");
			} else {
				throw error;
			}
		}

		// Test 3.6: Verify current lowest is ₹400
		const lowestBid = await getCurrentLowestBid(order.id);
		if (Number(lowestBid?.price_per_unit) === 400) {
			console.log("✅ Current lowest bid is ₹400");
		} else {
			throw new Error("Lowest bid mismatch");
		}

		TEST_DATA.pooledOrders.push(order);
		console.log("✅ Test Suite 3 PASSED\n");
	} catch (error: any) {
		console.error("❌ Test Suite 3 FAILED:", error.message);
		throw error;
	}
}

// Test suite 4: Auction status validation
async function testAuctionStatusValidation() {
	console.log("=".repeat(60));
	console.log("TEST SUITE 4: Auction Status Validation");
	console.log("=".repeat(60));

	try {
		// Test 4.1: Reject bid on closed auction
		console.log("\n📝 Test 4.1: Reject bid on closed auction");
		const closedOrder = await prisma.pooledOrder.create({
			data: {
				area_group_id: TEST_DATA.areaGroup.id,
				product_id: TEST_DATA.product.id,
				total_quantity_committed: 100,
				status: "AUCTION_CLOSED",
				auction_ends_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
			},
		});

		try {
			await submitBid(closedOrder.id, TEST_DATA.suppliers[0].user_id, 500);
			throw new Error("Should have rejected bid on closed auction");
		} catch (error: any) {
			if (error.message.includes("not currently accepting bids")) {
				console.log("✅ Correctly rejected bid on closed auction");
			} else {
				throw error;
			}
		}

		// Test 4.2: Reject bid on expired auction
		console.log("\n📝 Test 4.2: Reject bid on expired auction");
		const expiredOrder = await prisma.pooledOrder.create({
			data: {
				area_group_id: TEST_DATA.areaGroup.id,
				product_id: TEST_DATA.product.id,
				total_quantity_committed: 100,
				status: "AUCTION_OPEN",
				auction_ends_at: new Date(Date.now() - 1000), // 1 second ago
			},
		});

		try {
			await submitBid(expiredOrder.id, TEST_DATA.suppliers[0].user_id, 500);
			throw new Error("Should have rejected bid on expired auction");
		} catch (error: any) {
			if (error.message.includes("not currently accepting bids")) {
				console.log("✅ Correctly rejected bid on expired auction");
			} else {
				throw error;
			}
		}

		// Test 4.3: Verify isAuctionActive function
		console.log("\n📝 Test 4.3: Test isAuctionActive function");
		const activeOrder = await prisma.pooledOrder.create({
			data: {
				area_group_id: TEST_DATA.areaGroup.id,
				product_id: TEST_DATA.product.id,
				total_quantity_committed: 100,
				status: "AUCTION_OPEN",
				auction_ends_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
			},
		});

		if (isAuctionActive(activeOrder)) {
			console.log("✅ Active auction correctly identified");
		} else {
			throw new Error("Active auction not identified");
		}

		if (!isAuctionActive(closedOrder)) {
			console.log("✅ Closed auction correctly identified as inactive");
		} else {
			throw new Error("Closed auction incorrectly identified as active");
		}

		if (!isAuctionActive(expiredOrder)) {
			console.log("✅ Expired auction correctly identified as inactive");
		} else {
			throw new Error("Expired auction incorrectly identified as active");
		}

		TEST_DATA.pooledOrders.push(closedOrder, expiredOrder, activeOrder);
		console.log("✅ Test Suite 4 PASSED\n");
	} catch (error: any) {
		console.error("❌ Test Suite 4 FAILED:", error.message);
		throw error;
	}
}

// Test suite 5: Supplier verification validation
async function testSupplierVerification() {
	console.log("=".repeat(60));
	console.log("TEST SUITE 5: Supplier Verification Validation");
	console.log("=".repeat(60));

	try {
		const order = await prisma.pooledOrder.create({
			data: {
				area_group_id: TEST_DATA.areaGroup.id,
				product_id: TEST_DATA.product.id,
				total_quantity_committed: 100,
				status: "AUCTION_OPEN",
				auction_ends_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
			},
		});

		// Test 5.1: Reject bid from unverified supplier
		console.log("\n📝 Test 5.1: Reject bid from unverified supplier");
		const unverifiedSupplier = TEST_DATA.suppliers.find(
			(s) => s.verification_status === "PENDING"
		);

		if (!unverifiedSupplier) {
			throw new Error("Unverified supplier not found in test data");
		}

		try {
			await submitBid(order.id, unverifiedSupplier.user_id, 500);
			throw new Error("Should have rejected bid from unverified supplier");
		} catch (error: any) {
			if (error.message.includes("must be verified")) {
				console.log("✅ Correctly rejected bid from unverified supplier");
			} else {
				throw error;
			}
		}

		// Test 5.2: Accept bid from verified supplier
		console.log("\n📝 Test 5.2: Accept bid from verified supplier");
		const verifiedSupplier = TEST_DATA.suppliers.find(
			(s) => s.verification_status === "VERIFIED"
		);
		const bid = await submitBid(order.id, verifiedSupplier!.user_id, 500);
		console.log("✅ Bid from verified supplier accepted");

		TEST_DATA.pooledOrders.push(order);
		console.log("✅ Test Suite 5 PASSED\n");
	} catch (error: any) {
		console.error("❌ Test Suite 5 FAILED:", error.message);
		throw error;
	}
}

// Test suite 6: Auction awarding
async function testAuctionAwarding() {
	console.log("=".repeat(60));
	console.log("TEST SUITE 6: Auction Awarding");
	console.log("=".repeat(60));

	try {
		// Test 6.1: Award auction with bids
		console.log("\n📝 Test 6.1: Award auction with multiple bids");
		const order = await prisma.pooledOrder.create({
			data: {
				area_group_id: TEST_DATA.areaGroup.id,
				product_id: TEST_DATA.product.id,
				total_quantity_committed: 100,
				status: "AUCTION_OPEN",
				auction_ends_at: new Date(Date.now() - 1000), // Expired
			},
		});

		// Create multiple bids
		const bid1 = await prisma.bid.create({
			data: {
				pooled_order_id: order.id,
				supplier_id: TEST_DATA.suppliers[0].user_id,
				price_per_unit: 500,
			},
		});

		const bid2 = await prisma.bid.create({
			data: {
				pooled_order_id: order.id,
				supplier_id: TEST_DATA.suppliers[1].user_id,
				price_per_unit: 450,
			},
		});

		const bid3 = await prisma.bid.create({
			data: {
				pooled_order_id: order.id,
				supplier_id: TEST_DATA.suppliers[2].user_id,
				price_per_unit: 400,
			},
		});

		console.log("✅ Created 3 bids: ₹500, ₹450, ₹400");

		// Award the auction
		const awardedOrder = await awardAuction(order.id);
		console.log("✅ Auction awarded");

		// Verify winner is bid3 (lowest)
		if (
			awardedOrder.winning_bid_id === bid3.id &&
			awardedOrder.status === "AWARDED" &&
			Number(awardedOrder.final_price_per_unit) === 400
		) {
			console.log("✅ Correct bid awarded (₹400)");
		} else {
			throw new Error("Incorrect bid awarded");
		}

		// Test 6.2: Check bid status after awarding
		const status1 = await getSupplierBidStatus(bid1.id);
		const status2 = await getSupplierBidStatus(bid2.id);
		const status3 = await getSupplierBidStatus(bid3.id);

		if (status1.status === "OUTBID") {
			console.log("✅ Bid 1 correctly marked as OUTBID");
		} else {
			throw new Error(`Expected OUTBID for bid1, got ${status1.status}`);
		}

		if (status2.status === "OUTBID") {
			console.log("✅ Bid 2 correctly marked as OUTBID");
		} else {
			throw new Error(`Expected OUTBID for bid2, got ${status2.status}`);
		}

		if (status3.status === "AWARDED" && status3.isWinning) {
			console.log("✅ Bid 3 correctly marked as AWARDED");
		} else {
			throw new Error(`Expected AWARDED for bid3, got ${status3.status}`);
		}

		// Test 6.3: Reject awarding active auction
		console.log("\n📝 Test 6.3: Reject awarding active auction");
		const activeOrder = await prisma.pooledOrder.create({
			data: {
				area_group_id: TEST_DATA.areaGroup.id,
				product_id: TEST_DATA.product.id,
				total_quantity_committed: 100,
				status: "AUCTION_OPEN",
				auction_ends_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
			},
		});

		try {
			await awardAuction(activeOrder.id);
			throw new Error("Should have rejected awarding active auction");
		} catch (error: any) {
			if (error.message.includes("still active")) {
				console.log("✅ Correctly rejected awarding active auction");
			} else {
				throw error;
			}
		}

		// Test 6.4: Award auction with no bids (should close)
		console.log("\n📝 Test 6.4: Award auction with no bids");
		const emptyOrder = await prisma.pooledOrder.create({
			data: {
				area_group_id: TEST_DATA.areaGroup.id,
				product_id: TEST_DATA.product.id,
				total_quantity_committed: 100,
				status: "AUCTION_OPEN",
				auction_ends_at: new Date(Date.now() - 1000),
			},
		});

		const closedOrder = await awardAuction(emptyOrder.id);
		if (closedOrder.status === "AUCTION_CLOSED" && !closedOrder.winning_bid_id) {
			console.log("✅ Auction without bids correctly closed");
		} else {
			throw new Error("Auction without bids not handled correctly");
		}

		TEST_DATA.pooledOrders.push(order, activeOrder, emptyOrder);
		console.log("✅ Test Suite 6 PASSED\n");
	} catch (error: any) {
		console.error("❌ Test Suite 6 FAILED:", error.message);
		throw error;
	}
}

// Test suite 7: Multiple suppliers bidding scenario
async function testMultipleSuppliersBidding() {
	console.log("=".repeat(60));
	console.log("TEST SUITE 7: Multiple Suppliers Bidding Scenario");
	console.log("=".repeat(60));

	try {
		const order = await prisma.pooledOrder.create({
			data: {
				area_group_id: TEST_DATA.areaGroup.id,
				product_id: TEST_DATA.product.id,
				total_quantity_committed: 100,
				status: "AUCTION_OPEN",
				auction_ends_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
			},
		});

		console.log("\n📝 Simulating bidding war between 3 suppliers");

		// Supplier 1: ₹500
		const bid1 = await submitBid(order.id, TEST_DATA.suppliers[0].user_id, 500, "Bid 1");
		console.log(`✅ Supplier 1 bids: ₹500`);

		// Supplier 2: ₹450
		const bid2 = await submitBid(order.id, TEST_DATA.suppliers[1].user_id, 450, "Bid 2");
		console.log(`✅ Supplier 2 bids: ₹450`);

		// Supplier 3: ₹400
		const bid3 = await submitBid(order.id, TEST_DATA.suppliers[2].user_id, 400, "Bid 3");
		console.log(`✅ Supplier 3 bids: ₹400`);

		// Supplier 1 tries again: ₹350
		const bid4 = await submitBid(order.id, TEST_DATA.suppliers[0].user_id, 350, "Bid 4");
		console.log(`✅ Supplier 1 bids again: ₹350`);

		// Verify final state
		const lowestBid = await getCurrentLowestBid(order.id);
		if (lowestBid?.id === bid4.id && Number(lowestBid.price_per_unit) === 350) {
			console.log("✅ Final lowest bid is ₹350");
		} else {
			throw new Error("Final lowest bid mismatch");
		}

		// Check all bid statuses
		const status1 = await getSupplierBidStatus(bid1.id);
		const status2 = await getSupplierBidStatus(bid2.id);
		const status3 = await getSupplierBidStatus(bid3.id);
		const status4 = await getSupplierBidStatus(bid4.id);

		console.log(`\n📊 Bid Status Summary:`);
		console.log(`  Bid 1 (₹500): ${status1.status}`);
		console.log(`  Bid 2 (₹450): ${status2.status}`);
		console.log(`  Bid 3 (₹400): ${status3.status}`);
		console.log(`  Bid 4 (₹350): ${status4.status}`);

		if (
			status1.status === "OUTBID" &&
			status2.status === "OUTBID" &&
			status3.status === "OUTBID" &&
			status4.status === "WINNING"
		) {
			console.log("✅ All bid statuses are correct");
		} else {
			throw new Error("Bid statuses are incorrect");
		}

		TEST_DATA.pooledOrders.push(order);
		console.log("✅ Test Suite 7 PASSED\n");
	} catch (error: any) {
		console.error("❌ Test Suite 7 FAILED:", error.message);
		throw error;
	}
}

// Test suite 8: Edge cases
async function testEdgeCases() {
	console.log("=".repeat(60));
	console.log("TEST SUITE 8: Edge Cases");
	console.log("=".repeat(60));

	try {
		// Test 8.1: Invalid price (negative)
		console.log("\n📝 Test 8.1: Reject negative price");
		const order = await prisma.pooledOrder.create({
			data: {
				area_group_id: TEST_DATA.areaGroup.id,
				product_id: TEST_DATA.product.id,
				total_quantity_committed: 100,
				status: "AUCTION_OPEN",
				auction_ends_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
			},
		});

		try {
			await submitBid(order.id, TEST_DATA.suppliers[0].user_id, -100);
			throw new Error("Should have rejected negative price");
		} catch (error: any) {
			if (error.message.includes("positive number")) {
				console.log("✅ Correctly rejected negative price");
			} else {
				throw error;
			}
		}

		// Test 8.2: Invalid price (zero)
		console.log("\n📝 Test 8.2: Reject zero price");
		try {
			await submitBid(order.id, TEST_DATA.suppliers[0].user_id, 0);
			throw new Error("Should have rejected zero price");
		} catch (error: any) {
			if (error.message.includes("positive number")) {
				console.log("✅ Correctly rejected zero price");
			} else {
				throw error;
			}
		}

		// Test 8.3: Non-existent order
		console.log("\n📝 Test 8.3: Reject bid on non-existent order");
		try {
			await submitBid(99999, TEST_DATA.suppliers[0].user_id, 500);
			throw new Error("Should have rejected bid on non-existent order");
		} catch (error: any) {
			if (error.message.includes("not found")) {
				console.log("✅ Correctly rejected bid on non-existent order");
			} else {
				throw error;
			}
		}

		// Test 8.4: Non-existent supplier
		console.log("\n📝 Test 8.4: Reject bid from non-existent supplier");
		try {
			await submitBid(order.id, "non-existent-supplier", 500);
			throw new Error("Should have rejected bid from non-existent supplier");
		} catch (error: any) {
			if (error.message.includes("not found")) {
				console.log("✅ Correctly rejected bid from non-existent supplier");
			} else {
				throw error;
			}
		}

		// Test 8.5: Calculate min next bid with no bids
		console.log("\n📝 Test 8.5: Calculate min next bid with no bids");
		const emptyOrder = await prisma.pooledOrder.create({
			data: {
				area_group_id: TEST_DATA.areaGroup.id,
				product_id: TEST_DATA.product.id,
				total_quantity_committed: 100,
				status: "AUCTION_OPEN",
				auction_ends_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
			},
		});

		const minBid = await calculateMinNextBid(emptyOrder.id, 50);
		if (minBid === null) {
			console.log("✅ Correctly returned null for min bid with no existing bids");
		} else {
			throw new Error("Expected null for min bid with no existing bids");
		}

		TEST_DATA.pooledOrders.push(order, emptyOrder);
		console.log("✅ Test Suite 8 PASSED\n");
	} catch (error: any) {
		console.error("❌ Test Suite 8 FAILED:", error.message);
		throw error;
	}
}

// Main test runner
async function runAllTests() {
	console.log("\n🚀 Starting Bidding Logic Tests\n");
	console.log("=".repeat(60));

	try {
		// Cleanup first
		await cleanup();

		// Setup test data
		await setupTestData();

		// Run all test suites
		await testBasicBidSubmission();
		await testReverseAuctionLogic();
		await testMinimumDecrement();
		await testAuctionStatusValidation();
		await testSupplierVerification();
		await testAuctionAwarding();
		await testMultipleSuppliersBidding();
		await testEdgeCases();

		console.log("=".repeat(60));
		console.log("🎉 ALL TESTS PASSED!");
		console.log("=".repeat(60));
	} catch (error: any) {
		console.error("\n" + "=".repeat(60));
		console.error("💥 TESTS FAILED!");
		console.error("=".repeat(60));
		console.error("Error:", error.message);
		console.error("\nStack trace:", error.stack);
		process.exit(1);
	} finally {
		// Cleanup
		await cleanup();
		await prisma.$disconnect();
	}
}

// Run tests
runAllTests();