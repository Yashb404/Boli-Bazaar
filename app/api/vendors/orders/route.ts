import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { successResponse, errorResponse, serverErrorResponse } from "@/lib/utils/api-response";
import type { VendorOrderItem } from "@/types/auction";

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const vendorId = searchParams.get("vendor_id");

		if (!vendorId) {
			return errorResponse("MISSING_VENDOR_ID", "vendor_id query parameter is required", 400);
		}

		// Verify vendor exists
		const vendor = await prisma.vendor.findUnique({
			where: { user_id: vendorId },
			select: { user_id: true },
		});

		if (!vendor) {
			return errorResponse("VENDOR_NOT_FOUND", "Vendor not found", 404);
		}

		// Fetch all order items for this vendor
		const orderItems = await prisma.orderItem.findMany({
			where: { vendor_id: vendorId },
			include: {
				pooledOrder: {
					include: {
						product: {
							select: {
								name: true,
								unit: true,
							},
						},
					},
				},
			},
			orderBy: {
				created_at: "desc",
			},
		});

		// Transform to match VendorOrderItem type
		const transformedOrders: VendorOrderItem[] = orderItems.map((item: { id: any; quantity_committed: any; status: any; pooledOrder: { id: any; status: any; final_price_per_unit: any; product: { name: any; unit: any; }; }; }) => ({
			id: item.id,
			quantity_committed: Number(item.quantity_committed),
			status: item.status as any,
			pooledOrder: {
				id: item.pooledOrder.id,
				status: item.pooledOrder.status as any,
				final_price_per_unit: item.pooledOrder.final_price_per_unit
					? Number(item.pooledOrder.final_price_per_unit)
					: null,
				product: {
					name: item.pooledOrder.product.name,
					unit: item.pooledOrder.product.unit,
				},
			},
		}));

		return successResponse({
			orders: transformedOrders,
			total: transformedOrders.length,
		});
	} catch (error: any) {
		console.error("Error fetching vendor orders:", error);
		return serverErrorResponse("Failed to fetch vendor orders");
	}
}

