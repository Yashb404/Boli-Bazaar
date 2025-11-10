import { NextRequest } from "next/server";
import { submitBid } from "@/lib/services/bid-service";
import { submitBidSchema } from "@/lib/validators/bid";
import { successResponse, errorResponse, serverErrorResponse, conflictResponse } from "@/lib/utils/api-response";
import prisma from "@/lib/prisma";
import type { BidWithSupplier } from "@/types/auction";

export async function POST(request: NextRequest) {
	try {
		// Parse request body - handle empty or invalid JSON
		let body;
		try {
			body = await request.json();
		} catch (parseError) {
			return errorResponse("INVALID_JSON", "Invalid or empty JSON body", 400);
		}

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
		// Handle validation errors (Zod schema validation)
		if (error?.name === "ZodError") {
			console.error("Validation error:", error.errors);
			return errorResponse("VALIDATION_ERROR", error.errors[0]?.message || "Invalid request data", 400);
		}

		// Extract error message (handle both Error objects and plain objects)
		// Try multiple ways to get the error message
		let errorMessage: string;
		if (typeof error === "string") {
			errorMessage = error;
		} else if (error?.message) {
			errorMessage = error.message;
		} else if (error?.toString) {
			errorMessage = error.toString();
		} else {
			errorMessage = "Unknown error occurred";
		}

		const errorMessageLower = errorMessage.toLowerCase();

		// Log the error for debugging
		console.error("Error submitting bid:", {
			error,
			errorMessage,
			errorType: typeof error,
			errorName: error?.name,
		});

		// Handle business logic errors from bid-service that should return 409 Conflict
		// These are validation errors from the business logic layer
		const isBusinessLogicError =
			errorMessageLower.includes("not found") ||
			errorMessageLower.includes("not currently accepting") ||
			errorMessageLower.includes("must be verified") ||
			errorMessageLower.includes("must be lower") ||
			errorMessageLower.includes("at least") ||
			errorMessageLower.includes("cannot award") ||
			errorMessageLower.includes("still active") ||
			errorMessageLower.includes("positive number") ||
			errorMessageLower.includes("bid must");

		if (isBusinessLogicError) {
			return conflictResponse(errorMessage);
		}

		// If we get here, it's an unexpected server error
		console.error("Unexpected error in bid submission - returning 500:", {
			error,
			errorMessage,
			stack: error?.stack,
		});
		return serverErrorResponse("Failed to submit bid");
	}
}

