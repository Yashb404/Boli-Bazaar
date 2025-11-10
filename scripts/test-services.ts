import prisma from "../lib/prisma";
import { submitBid, getSupplierBidStatus } from "../lib/services/bid-service";
import { awardAuction, getCurrentLowestBid, isAuctionActive } from "../lib/services/auction-service";

async function testServices() {
  try {
    // 1. Create test data
    console.log("Creating test data...");
    
    // Create a city
    const city = await prisma.city.create({
      data: {
        name: "Mumbai",
        map_center: [19.0760, 72.8777],
        default_zoom: 11
      }
    });

    // Create an area group
    const areaGroup = await prisma.areaGroup.create({
      data: {
        area_name: "North Mumbai",
        city_id: city.id,
        location_center: [19.0760, 72.8777]
      }
    });

    // Create a product
    const product = await prisma.product.create({
      data: {
        name: "Tomatoes",
        grade: "A",
        unit: "kg",
        description: "Fresh tomatoes"
      }
    });

    // Create a test user (supplier)
    const supplierUser = await prisma.user.create({
      data: {
        id: "test-supplier-1",
        email: "supplier@test.com",
        role_type: "SUPPLIER",
        full_name: "Test Supplier"
      }
    });

    // Create a supplier
    const supplier = await prisma.supplier.create({
      data: {
        user_id: supplierUser.id,
        business_name: "Test Supplier Co",
        verification_status: "VERIFIED"
      }
    });

    // Create a pooled order
    const pooledOrder = await prisma.pooledOrder.create({
      data: {
        area_group_id: areaGroup.id,
        product_id: product.id,
        total_quantity_committed: 100,
        status: "AUCTION_OPEN",
        auction_ends_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
      }
    });

    console.log("✅ Test data created!");

    // 2. Test bid submission
    console.log("\nTesting bid submission...");
    const bid = await submitBid(
      pooledOrder.id,
      supplier.user_id,
      500, // price per unit
      "Test bid notes"
    );
    console.log("✅ Bid submitted:", bid);

    // 3. Test getting lowest bid
    console.log("\nTesting getCurrentLowestBid...");
    const lowestBid = await getCurrentLowestBid(pooledOrder.id);
    console.log("✅ Lowest bid:", lowestBid);

    // 4. Test bid status
    console.log("\nTesting getSupplierBidStatus...");
    const bidStatus = await getSupplierBidStatus(bid.id);
    console.log("✅ Bid status:", bidStatus);

    // 5. Test auction status
    console.log("\nTesting isAuctionActive...");
    const isActive = isAuctionActive(pooledOrder);
    console.log("✅ Auction active:", isActive);

    console.log("\n✅ All tests passed!");

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testServices();