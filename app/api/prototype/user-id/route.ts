import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// PROTOTYPE ONLY: Returns a test supplier or vendor ID for development
// This should be removed when auth is implemented
export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const role = searchParams.get("role") || "supplier"; // 'supplier' or 'vendor'

		if (role === "supplier") {
			// Get first verified supplier, or create one if none exists
			let supplier = await prisma.supplier.findFirst({
				where: { verification_status: "VERIFIED" },
				select: { user_id: true },
			});

			if (!supplier) {
				// Create a test supplier
				const user = await prisma.user.create({
					data: {
						id: "prototype-supplier-1",
						email: "prototype-supplier@test.com",
						role_type: "SUPPLIER",
						full_name: "Prototype Supplier",
					},
				});

				supplier = await prisma.supplier.create({
					data: {
						user_id: user.id,
						business_name: "Prototype Supplier Co",
						verification_status: "VERIFIED",
					},
					select: { user_id: true },
				});
			}

			return NextResponse.json({ user_id: supplier.user_id });
		} else if (role === "vendor") {
			// Get first vendor, or create one if none exists
			let vendor = await prisma.vendor.findFirst({
				select: { user_id: true },
			});

			if (!vendor) {
				// Create a test vendor
				const user = await prisma.user.create({
					data: {
						id: "prototype-vendor-1",
						email: "prototype-vendor@test.com",
						role_type: "VENDOR",
						full_name: "Prototype Vendor",
					},
				});

				vendor = await prisma.vendor.create({
					data: {
						user_id: user.id,
						reputation_score: 5.0,
					},
					select: { user_id: true },
				});
			}

			return NextResponse.json({ user_id: vendor.user_id });
		}

		return NextResponse.json({ error: "Invalid role" }, { status: 400 });
	} catch (error: any) {
		console.error("Error getting prototype user ID:", error);
		return NextResponse.json({ error: "Failed to get user ID" }, { status: 500 });
	}
}

