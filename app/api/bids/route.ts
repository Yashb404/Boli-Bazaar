import { NextRequest } from "next/server";
import { submitBid } from "@/lib/services/bid-service";
import { submitBidSchema } from "@/lib/validators/bid";
import { successResponse, errorResponse, serverErrorResponse, conflictResponse } from "@/lib/utils/api-response";
import prisma from "@/lib/prisma";
import type { BidWithSupplier } from "@/types/auction";

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();

		// Validate request body
		const validatedData = submitBidSchema.parse(body);

		// Submit bid using bid service (includes all validation)
		const bid = await submitBid(
			validatedData.pooled_order_id,
			validatedData.supplier_id,
			validatedData.price_per_unit,
			validatedData.notes || undefined
		);

		// Fetch the created bid with supplier info for response
		const bidWithSupplier = await prisma.bid.findUnique({
			where: { id: bid.id },
			include: {
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

		if (!bidWithSupplier) {
			return serverErrorResponse("Failed to retrieve created bid");
		}

		const transformedBid: BidWithSupplier = {
			id: bidWithSupplier.id,
			price_per_unit: Number(bidWithSupplier.price_per_unit),
			notes: bidWithSupplier.notes,
			created_at: bidWithSupplier.created_at.toISOString(),
			supplier: {
				user_id: bidWithSupplier.supplier.user_id,
				business_name: bidWithSupplier.supplier.business_name,
				verification_status: bidWithSupplier.supplier.verification_status as any,
				overall_rating: Number(bidWithSupplier.supplier.overall_rating),
				user: {
					full_name: bidWithSupplier.supplier.user.full_name,
					phone_number: bidWithSupplier.supplier.user.phone_number,
					email: bidWithSupplier.supplier.user.email,
				},
			},
		};

		return successResponse(
			{
				bid: transformedBid,
			},
			"Bid submitted successfully",
			201
		);
	} catch (error: any) {
		console.error("Error submitting bid:", error);

		// Handle validation errors
		if (error.name === "ZodError") {
			return errorResponse("VALIDATION_ERROR", error.errors[0].message, 400);
		}

		// Handle business logic errors from bid-service
		if (error.message) {
			// Check for specific error messages
			if (
				error.message.includes("not found") ||
				error.message.includes("not currently accepting") ||
				error.message.includes("must be verified") ||
				error.message.includes("must be lower")
			) {
				return conflictResponse(error.message);
			}
		}

		return serverErrorResponse("Failed to submit bid");
	}
}

