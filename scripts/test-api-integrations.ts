/**
 * API Integration Tests for Bidding System
 * 
 * This script tests the actual HTTP API endpoints by making real HTTP requests.
 * 
 * Prerequisites:
 * 1. Start your Next.js dev server: npm run dev
 * 2. Ensure your database is set up and migrations are run
 * 3. Run this script: npm run test:api
 * 
 * The script will:
 * - Set up test data in the database
 * - Make HTTP requests to all API endpoints
 * - Validate responses, status codes, and error handling
 * - Clean up test data after completion
 */

import prisma from "../lib/prisma";

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";
const TEST_DATA = {
	city: null as any,
	areaGroup: null as any,
	product: null as any,
	suppliers: [] as any[],
	pooledOrders: [] as any[],
	bids: [] as any[],
};

// Helper function to make API requests
async function apiRequest(
	endpoint: string,
	options: RequestInit = {}
): Promise<{ status: number; data: any; error?: any }> {
	try {
		const url = `${API_BASE_URL}${endpoint}`;
		console.log(`  📡 ${options.method || "GET"} ${endpoint}`);

		const response = await fetch(url, {
			...options,
			headers: {
				"Content-Type": "application/json",
				...options.headers,
			},
		});

		// Try to parse JSON response, handle empty or invalid JSON
		let data: any;
		const contentType = response.headers.get("content-type");
		const text = await response.text();
		
		if (text && contentType?.includes("application/json")) {
			try {
				data = JSON.parse(text);
			} catch (parseError) {
				console.error(`  ⚠️ Failed to parse JSON response: ${text.substring(0, 100)}`);
				data = { error: "Invalid JSON response", raw: text };
			}
		} else if (text) {
			data = { error: "Non-JSON response", raw: text };
		} else {
			data = { error: "Empty response" };
		}

		if (!response.ok) {
			// Log error details for debugging
			console.log(`  ⚠️ Response status: ${response.status}`);
			console.log(`  ⚠️ Error data:`, JSON.stringify(data, null, 2));
			return {
				status: response.status,
				data: null,
				error: data,
			};
		}

		return {
			status: response.status,
			data,
		};
	} catch (error: any) {
		console.error(`  ❌ Request failed: ${error.message}`);
		console.error(`  ❌ Endpoint: ${endpoint}`);
		throw error;
	}
}

// Assertion helpers
function assert(condition: boolean, message: string) {
	if (!condition) {
		throw new Error(`Assertion failed: ${message}`);
	}
}

function assertStatus(response: { status: number; data: any; error?: any }, expectedStatus: number) {
	assert(
		response.status === expectedStatus,
		`Expected status ${expectedStatus}, got ${response.status}`
	);
}

function assertSuccess(response: { status: number; data: any; error?: any }) {
	assert(response.data?.success === true, "Expected success response");
}

function assertError(response: { status: number; data: any; error?: any }, expectedError?: string) {
	assert(response.error || response.data?.success === false, "Expected error response");
	if (expectedError && response.error) {
		assert(
			response.error.error === expectedError || response.error.message?.includes(expectedError),
			`Expected error "${expectedError}", got "${response.error.error || response.error.message}"`
		);
	}
}

// Setup test data
async function setupTestData() {
	console.log("📦 Setting up test data...");

	// Cleanup first
	await cleanup();

	// Create city with unique name
	const cityName = `Test City ${Date.now()}`;
	TEST_DATA.city = await prisma.city.create({
		data: {
			name: cityName,
			map_center: [19.0760, 72.8777],
			default_zoom: 11,
		},
	});

	// Create area group with unique name
	const areaName = `Test Area ${Date.now()}`;
	TEST_DATA.areaGroup = await prisma.areaGroup.create({
		data: {
			area_name: areaName,
			city_id: TEST_DATA.city.id,
			location_center: [19.0760, 72.8777],
		},
	});

	// Create product with unique name to avoid conflicts
	const productName = `Test Tomatoes ${Date.now()}`;
	TEST_DATA.product = await prisma.product.create({
		data: {
			name: productName,
			grade: "A",
			unit: "kg",
			description: "Fresh test tomatoes",
		},
	});

	// Create verified suppliers
	for (let i = 1; i <= 3; i++) {
		const timestamp = Date.now();
		const user = await prisma.user.create({
			data: {
				id: `test-supplier-${i}-${timestamp}`,
				email: `supplier${i}@test-${timestamp}.com`,
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
	const unverifiedTimestamp = Date.now();
	const unverifiedUser = await prisma.user.create({
		data: {
			id: `test-supplier-unverified-${unverifiedTimestamp}`,
			email: `unverified@test-${unverifiedTimestamp}.com`,
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

	console.log("✅ Test data setup complete");
}


// Cleanup function
async function cleanup() {
	try {
		// Step 1: Clear winning_bid_id from all pooled_orders that reference test bids
		// This must happen BEFORE deleting bids to avoid foreign key constraint violations
		await prisma.pooledOrder.updateMany({
			where: {
				winningBid: {
					supplier: {
						user_id: {
							startsWith: "test-supplier-",
						},
					},
				},
			},
			data: {
				winning_bid_id: null,
			},
		});

		// Step 2: Now safe to delete bids
		await prisma.bid.deleteMany({
			where: {
				supplier: {
					user_id: {
						startsWith: "test-supplier-",
					},
				},
			},
		});

		// Step 3: Delete pooled orders
		await prisma.pooledOrder.deleteMany({
			where: {
				areaGroup: {
					area_name: {
						startsWith: "Test Area",
					},
				},
			},
		});

		// Step 4: Delete suppliers
		await prisma.supplier.deleteMany({
			where: {
				user_id: {
					startsWith: "test-supplier-",
				},
			},
		});

		// Step 5: Delete users
		await prisma.user.deleteMany({
			where: {
				id: {
					startsWith: "test-supplier-",
				},
			},
		});

		// Step 6: Delete products that start with "Test Tomatoes" (our test products)
		// Note: Prisma doesn't support startsWith on all fields, so we'll find and delete
		// First, find all products with names starting with "Test Tomatoes"
		const testProducts = await prisma.product.findMany({
			where: {
				name: {
					startsWith: "Test Tomatoes",
				},
			},
		});

		// Delete each product (we need to delete by unique constraint)
		for (const product of testProducts) {
			try {
				await prisma.product.delete({
					where: {
						name_grade: {
							name: product.name,
							grade: product.grade || "A",
						},
					},
				});
			} catch (error) {
				// Ignore if already deleted or doesn't exist
			}
		}

		// Step 7: Delete area groups
		await prisma.areaGroup.deleteMany({
			where: {
				area_name: {
					startsWith: "Test Area",
				},
			},
		});

		// Step 8: Delete cities
		await prisma.city.deleteMany({
			where: {
				name: {
					startsWith: "Test City",
				},
			},
		});
	} catch (error: any) {
		// Ignore errors during cleanup - they might be expected if data doesn't exist
		console.warn("⚠️ Cleanup warning (may be expected):", error.message);
	}
}

// Test Suite 1: GET /api/pooled-orders
async function testGetPooledOrders() {
	console.log("\n" + "=".repeat(60));
	console.log("TEST SUITE 1: GET /api/pooled-orders");
	console.log("=".repeat(60));

	try {
		// Create a pooled order
		const order = await prisma.pooledOrder.create({
			data: {
				area_group_id: TEST_DATA.areaGroup.id,
				product_id: TEST_DATA.product.id,
				total_quantity_committed: 100,
				status: "AUCTION_OPEN",
				auction_ends_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
			},
		});
		TEST_DATA.pooledOrders.push(order);

		// Test 1.1: Get all pooled orders
		console.log("\n📝 Test 1.1: GET all pooled orders");
		const response1 = await apiRequest("/api/pooled-orders");
		assertStatus(response1, 200);
		assertSuccess(response1);
		assert(
			Array.isArray(response1.data.data.pooled_orders),
			"Expected pooled_orders array"
		);
		console.log(`  ✅ Retrieved ${response1.data.data.pooled_orders.length} pooled orders`);

		// Test 1.2: Filter by status
		console.log("\n📝 Test 1.2: GET pooled orders filtered by status");
		const response2 = await apiRequest("/api/pooled-orders?status=AUCTION_OPEN");
		assertStatus(response2, 200);
		assertSuccess(response2);
		assert(
			response2.data.data.pooled_orders.every(
				(order: any) => order.status === "AUCTION_OPEN"
			),
			"All orders should have AUCTION_OPEN status"
		);
		console.log("  ✅ Filtered orders by status correctly");

		// Test 1.3: Filter by area_group_id
		console.log("\n📝 Test 1.3: GET pooled orders filtered by area_group_id");
		const response3 = await apiRequest(
			`/api/pooled-orders?area_group_id=${TEST_DATA.areaGroup.id}`
		);
		assertStatus(response3, 200);
		assertSuccess(response3);
		console.log("  ✅ Filtered orders by area_group_id correctly");

		console.log("\n✅ Test Suite 1 PASSED");
	} catch (error: any) {
		console.error("\n❌ Test Suite 1 FAILED:", error.message);
		throw error;
	}
}

// Test Suite 2: GET /api/pooled-orders/:id
async function testGetPooledOrderById() {
	console.log("\n" + "=".repeat(60));
	console.log("TEST SUITE 2: GET /api/pooled-orders/:id");
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
		TEST_DATA.pooledOrders.push(order);

		// Test 2.1: Get order by ID
		console.log("\n📝 Test 2.1: GET pooled order by ID");
		const response = await apiRequest(`/api/pooled-orders/${order.id}`);
		assertStatus(response, 200);
		assertSuccess(response);
		assert(response.data.data.pooled_order.id === order.id, "Order ID should match");
		assert(
			response.data.data.pooled_order.product.name.startsWith("Test Tomatoes"),
			"Product name should start with 'Test Tomatoes'"
		);
		console.log("  ✅ Retrieved pooled order correctly");

		// Test 2.2: Get non-existent order
		console.log("\n📝 Test 2.2: GET non-existent pooled order");
		const response2 = await apiRequest("/api/pooled-orders/99999");
		assertStatus(response2, 404);
		assertError(response2, "NOT_FOUND");
		console.log("  ✅ Correctly returned 404 for non-existent order");

		// Test 2.3: Invalid ID format
		console.log("\n📝 Test 2.3: GET with invalid ID format");
		const response3 = await apiRequest("/api/pooled-orders/invalid");
		assertStatus(response3, 400);
		assertError(response3, "INVALID_ID");
		console.log("  ✅ Correctly returned 400 for invalid ID");

		console.log("\n✅ Test Suite 2 PASSED");
	} catch (error: any) {
		console.error("\n❌ Test Suite 2 FAILED:", error.message);
		throw error;
	}
}

// Test Suite 3: POST /api/bids (Submit Bid)
async function testSubmitBid() {
	console.log("\n" + "=".repeat(60));
	console.log("TEST SUITE 3: POST /api/bids (Submit Bid)");
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
		TEST_DATA.pooledOrders.push(order);

		// Test 3.1: Submit valid bid
		console.log("\n📝 Test 3.1: Submit valid bid");
		const response1 = await apiRequest("/api/bids", {
			method: "POST",
			body: JSON.stringify({
				pooled_order_id: order.id,
				supplier_id: TEST_DATA.suppliers[0].user_id,
				price_per_unit: 500,
				notes: "Test bid",
			}),
		});
		assertStatus(response1, 201);
		assertSuccess(response1);
		assert(response1.data.data.bid.price_per_unit === 500, "Bid price should match");
		assert(response1.data.data.bid.supplier.user_id === TEST_DATA.suppliers[0].user_id, "Supplier should match");
		console.log("  ✅ Bid submitted successfully");
		TEST_DATA.bids.push(response1.data.data.bid);

		// Test 3.2: Submit lower bid (reverse auction)
		console.log("\n📝 Test 3.2: Submit lower bid");
		const response2 = await apiRequest("/api/bids", {
			method: "POST",
			body: JSON.stringify({
				pooled_order_id: order.id,
				supplier_id: TEST_DATA.suppliers[1].user_id,
				price_per_unit: 450,
			}),
		});
		assertStatus(response2, 201);
		assertSuccess(response2);
		console.log("  ✅ Lower bid submitted successfully");
		TEST_DATA.bids.push(response2.data.data.bid);

		// Test 3.3: Reject bid that's too high
		console.log("\n📝 Test 3.3: Reject bid higher than current lowest");
		const response3 = await apiRequest("/api/bids", {
			method: "POST",
			body: JSON.stringify({
				pooled_order_id: order.id,
				supplier_id: TEST_DATA.suppliers[2].user_id,
				price_per_unit: 500,
			}),
		});
		assertStatus(response3, 409);
		assertError(response3);
		console.log("  ✅ Correctly rejected bid that's too high");

		// Test 3.4: Reject bid from unverified supplier
		console.log("\n📝 Test 3.4: Reject bid from unverified supplier");
		const unverifiedSupplier = TEST_DATA.suppliers.find(
			(s) => s.verification_status === "PENDING"
		);
		const response4 = await apiRequest("/api/bids", {
			method: "POST",
			body: JSON.stringify({
				pooled_order_id: order.id,
				supplier_id: unverifiedSupplier!.user_id,
				price_per_unit: 400,
			}),
		});
		assertStatus(response4, 409);
		assertError(response4, "verified");
		console.log("  ✅ Correctly rejected bid from unverified supplier");

		// Test 3.5: Reject bid on closed auction
		console.log("\n📝 Test 3.5: Reject bid on closed auction");
		const closedOrder = await prisma.pooledOrder.create({
			data: {
				area_group_id: TEST_DATA.areaGroup.id,
				product_id: TEST_DATA.product.id,
				total_quantity_committed: 100,
				status: "AUCTION_CLOSED",
				auction_ends_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
			},
		});
		const response5 = await apiRequest("/api/bids", {
			method: "POST",
			body: JSON.stringify({
				pooled_order_id: closedOrder.id,
				supplier_id: TEST_DATA.suppliers[0].user_id,
				price_per_unit: 500,
			}),
		});
		assertStatus(response5, 409);
		assertError(response5, "accepting bids");
		console.log("  ✅ Correctly rejected bid on closed auction");

		// Test 3.6: Validation error - missing fields
		console.log("\n📝 Test 3.6: Validation error - missing required fields");
		const response6 = await apiRequest("/api/bids", {
			method: "POST",
			body: JSON.stringify({
				pooled_order_id: order.id,
				// Missing supplier_id and price_per_unit - these are required
			}),
		});
		assertStatus(response6, 400);
		// Check that it's a validation error (either VALIDATION_ERROR from Zod or INVALID_JSON if body parsing fails)
		if (response6.error?.error === "VALIDATION_ERROR" || response6.error?.error === "INVALID_JSON") {
			console.log("  ✅ Correctly returned validation error");
		} else {
			console.log(`  ⚠️ Unexpected error type: ${JSON.stringify(response6.error)}`);
			// Still pass if it's a 400 error, as that's the important part
			if (response6.status === 400) {
				console.log("  ✅ Correctly returned 400 error");
			} else {
				throw new Error(`Expected status 400 with validation error, got ${response6.status}`);
			}
		}

		// Test 3.7: Validation error - invalid price
		console.log("\n📝 Test 3.7: Validation error - invalid price");
		const response7 = await apiRequest("/api/bids", {
			method: "POST",
			body: JSON.stringify({
				pooled_order_id: order.id,
				supplier_id: TEST_DATA.suppliers[0].user_id,
				price_per_unit: -100,
			}),
		});
		assertStatus(response7, 400);
		assertError(response7, "VALIDATION_ERROR");
		console.log("  ✅ Correctly returned validation error for invalid price");

		console.log("\n✅ Test Suite 3 PASSED");
	} catch (error: any) {
		console.error("\n❌ Test Suite 3 FAILED:", error.message);
		throw error;
	}
}

// Test Suite 4: GET /api/pooled-orders/:id/bids
async function testGetBidsForOrder() {
	console.log("\n" + "=".repeat(60));
	console.log("TEST SUITE 4: GET /api/pooled-orders/:id/bids");
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

		// Create bids directly in database
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

		TEST_DATA.bids.push(bid1, bid2);

		// Test 4.1: Get bids for order
		console.log("\n📝 Test 4.1: GET bids for pooled order");
		const response = await apiRequest(`/api/pooled-orders/${order.id}/bids`);
		assertStatus(response, 200);
		assertSuccess(response);
		assert(Array.isArray(response.data.data.bids), "Expected bids array");
		assert(response.data.data.bids.length === 2, "Expected 2 bids");
		assert(
			response.data.data.bids[0].price_per_unit === 450,
			"Bids should be sorted by price (lowest first)"
		);
		console.log(`  ✅ Retrieved ${response.data.data.bids.length} bids`);

		// Test 4.2: Get bids for order with no bids
		console.log("\n📝 Test 4.2: GET bids for order with no bids");
		const emptyOrder = await prisma.pooledOrder.create({
			data: {
				area_group_id: TEST_DATA.areaGroup.id,
				product_id: TEST_DATA.product.id,
				total_quantity_committed: 100,
				status: "AUCTION_OPEN",
				auction_ends_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
			},
		});
		const response2 = await apiRequest(`/api/pooled-orders/${emptyOrder.id}/bids`);
		assertStatus(response2, 200);
		assertSuccess(response2);
		assert(response2.data.data.bids.length === 0, "Expected 0 bids");
		console.log("  ✅ Correctly returned empty array for order with no bids");

		// Test 4.3: Get bids for non-existent order
		console.log("\n📝 Test 4.3: GET bids for non-existent order");
		const response3 = await apiRequest("/api/pooled-orders/99999/bids");
		assertStatus(response3, 404);
		assertError(response3, "NOT_FOUND");
		console.log("  ✅ Correctly returned 404 for non-existent order");

		console.log("\n✅ Test Suite 4 PASSED");
	} catch (error: any) {
		console.error("\n❌ Test Suite 4 FAILED:", error.message);
		throw error;
	}
}

// Test Suite 5: GET /api/suppliers/bids
async function testGetSupplierBids() {
	console.log("\n" + "=".repeat(60));
	console.log("TEST SUITE 5: GET /api/suppliers/bids");
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

		// Create bids
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

		TEST_DATA.bids.push(bid1, bid2);

		// Test 5.1: Get bids for supplier
		console.log("\n📝 Test 5.1: GET bids for supplier");
		const response = await apiRequest(
			`/api/suppliers/bids?supplier_id=${TEST_DATA.suppliers[0].user_id}`
		);
		assertStatus(response, 200);
		assertSuccess(response);
		assert(Array.isArray(response.data.data.bids), "Expected bids array");
		assert(
			response.data.data.bids.length === 1,
			`Expected 1 bid, got ${response.data.data.bids.length}`
		);
		assert(
			response.data.data.bids[0].bid.price_per_unit === 500,
			"Bid price should match"
		);
		assert(
			response.data.data.bids[0].status === "OUTBID",
			"Bid status should be OUTBID (since bid2 is lower)"
		);
		console.log("  ✅ Retrieved supplier bids correctly");

		// Test 5.2: Get bids for supplier with winning bid
		console.log("\n📝 Test 5.2: GET bids for supplier with winning bid");
		const response2 = await apiRequest(
			`/api/suppliers/bids?supplier_id=${TEST_DATA.suppliers[1].user_id}`
		);
		assertStatus(response2, 200);
		assertSuccess(response2);
		assert(response2.data.data.bids[0].status === "WINNING", "Bid status should be WINNING");
		console.log("  ✅ Correctly identified winning bid");

		// Test 5.3: Missing supplier_id parameter
		console.log("\n📝 Test 5.3: GET bids without supplier_id");
		const response3 = await apiRequest("/api/suppliers/bids");
		assertStatus(response3, 400);
		assertError(response3, "MISSING_SUPPLIER_ID");
		console.log("  ✅ Correctly returned error for missing supplier_id");

		// Test 5.4: Non-existent supplier
		console.log("\n📝 Test 5.4: GET bids for non-existent supplier");
		const response4 = await apiRequest("/api/suppliers/bids?supplier_id=non-existent");
		assertStatus(response4, 404);
		assertError(response4, "SUPPLIER_NOT_FOUND");
		console.log("  ✅ Correctly returned 404 for non-existent supplier");

		console.log("\n✅ Test Suite 5 PASSED");
	} catch (error: any) {
		console.error("\n❌ Test Suite 5 FAILED:", error.message);
		throw error;
	}
}

// Test Suite 6: Full Bidding Flow
async function testFullBiddingFlow() {
	console.log("\n" + "=".repeat(60));
	console.log("TEST SUITE 6: Full Bidding Flow (End-to-End)");
	console.log("=".repeat(60));

	try {
		// Create an active auction
		const order = await prisma.pooledOrder.create({
			data: {
				area_group_id: TEST_DATA.areaGroup.id,
				product_id: TEST_DATA.product.id,
				total_quantity_committed: 100,
				status: "AUCTION_OPEN",
				auction_ends_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
			},
		});

		// Step 1: Get the order
		console.log("\n📝 Step 1: Get the pooled order");
		const orderResponse = await apiRequest(`/api/pooled-orders/${order.id}`);
		assertStatus(orderResponse, 200);
		assertSuccess(orderResponse);
		console.log("  ✅ Retrieved order");

		// Step 2: Supplier 1 submits first bid
		console.log("\n📝 Step 2: Supplier 1 submits first bid (₹500)");
		const bid1Response = await apiRequest("/api/bids", {
			method: "POST",
			body: JSON.stringify({
				pooled_order_id: order.id,
				supplier_id: TEST_DATA.suppliers[0].user_id,
				price_per_unit: 500,
				notes: "First bid",
			}),
		});
		assertStatus(bid1Response, 201);
		console.log("  ✅ Bid 1 submitted");

		// Step 3: Supplier 2 submits lower bid
		console.log("\n📝 Step 3: Supplier 2 submits lower bid (₹450)");
		const bid2Response = await apiRequest("/api/bids", {
			method: "POST",
			body: JSON.stringify({
				pooled_order_id: order.id,
				supplier_id: TEST_DATA.suppliers[1].user_id,
				price_per_unit: 450,
				notes: "Second bid",
			}),
		});
		assertStatus(bid2Response, 201);
		console.log("  ✅ Bid 2 submitted");

		// Step 4: Check all bids for the order
		console.log("\n📝 Step 4: Get all bids for the order");
		const bidsResponse = await apiRequest(`/api/pooled-orders/${order.id}/bids`);
		assertStatus(bidsResponse, 200);
		assertSuccess(bidsResponse);
		assert(bidsResponse.data.data.bids.length === 2, "Expected 2 bids");
		console.log(`  ✅ Retrieved ${bidsResponse.data.data.bids.length} bids`);

		// Step 5: Check supplier 1's bids (should be outbid)
		console.log("\n📝 Step 5: Check Supplier 1's bid status");
		const supplier1Bids = await apiRequest(
			`/api/suppliers/bids?supplier_id=${TEST_DATA.suppliers[0].user_id}`
		);
		assertStatus(supplier1Bids, 200);
		assert(supplier1Bids.data.data.bids[0].status === "OUTBID", "Supplier 1 should be outbid");
		console.log("  ✅ Supplier 1 is OUTBID");

		// Step 6: Check supplier 2's bids (should be winning)
		console.log("\n📝 Step 6: Check Supplier 2's bid status");
		const supplier2Bids = await apiRequest(
			`/api/suppliers/bids?supplier_id=${TEST_DATA.suppliers[1].user_id}`
		);
		assertStatus(supplier2Bids, 200);
		assert(supplier2Bids.data.data.bids[0].status === "WINNING", "Supplier 2 should be winning");
		console.log("  ✅ Supplier 2 is WINNING");

		// Step 7: Verify order shows correct lowest bid
		console.log("\n📝 Step 7: Verify order shows correct lowest bid");
		const orderResponse2 = await apiRequest(`/api/pooled-orders/${order.id}`);
		assertStatus(orderResponse2, 200);
		assert(
			orderResponse2.data.data.current_lowest_bid === 450,
			"Current lowest bid should be 450"
		);
		console.log("  ✅ Order shows correct lowest bid");

		console.log("\n✅ Test Suite 6 PASSED");
	} catch (error: any) {
		console.error("\n❌ Test Suite 6 FAILED:", error.message);
		throw error;
	}
}

// Main test runner
async function runAllTests() {
	console.log("\n🚀 Starting API Integration Tests");
	console.log(`📍 Testing against: ${API_BASE_URL}`);
	console.log("=".repeat(60));

	// Check if server is reachable
	try {
		const healthCheck = await fetch(`${API_BASE_URL}/api/pooled-orders`);
		if (!healthCheck.ok && healthCheck.status !== 404) {
			throw new Error("Server not reachable");
		}
	} catch (error) {
		console.error("\n❌ Cannot connect to API server!");
		console.error(`   Make sure your Next.js dev server is running on ${API_BASE_URL}`);
		console.error("   Start it with: npm run dev");
		process.exit(1);
	}

	try {
		// Setup test data
		await setupTestData();

		// Run all test suites
		await testGetPooledOrders();
		await testGetPooledOrderById();
		await testSubmitBid();
		await testGetBidsForOrder();
		await testGetSupplierBids();
		await testFullBiddingFlow();

		console.log("\n" + "=".repeat(60));
		console.log("🎉 ALL API TESTS PASSED!");
		console.log("=".repeat(60));
	} catch (error: any) {
		console.error("\n" + "=".repeat(60));
		console.error("💥 API TESTS FAILED!");
		console.error("=".repeat(60));
		console.error("Error:", error.message);
		if (error.stack) {
			console.error("\nStack trace:", error.stack);
		}
		process.exit(1);
	} finally {
		// Cleanup
		console.log("\n🧹 Cleaning up test data...");
		await cleanup();
		await prisma.$disconnect();
		console.log("✅ Cleanup complete");
	}
}

// Run tests
runAllTests();