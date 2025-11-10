import { NextResponse } from "next/server";

export type ApiSuccessResponse<T = any> = {
	success: true;
	data: T;
	message?: string;
};

export type ApiErrorResponse = {
	success: false;
	error: string;
	message?: string;
};

export function successResponse<T>(
	data: T,
	message?: string,
	status: number = 200
): NextResponse<ApiSuccessResponse<T>> {
	return NextResponse.json(
		{
			success: true,
			data,
			message,
		},
		{ status }
	);
}

export function errorResponse(
	error: string,
	message?: string,
	status: number = 400
): NextResponse<ApiErrorResponse> {
	return NextResponse.json(
		{
			success: false,
			error,
			message,
		},
		{ status }
	);
}

export function notFoundResponse(message: string = "Resource not found"): NextResponse<ApiErrorResponse> {
	return errorResponse("NOT_FOUND", message, 404);
}

export function unauthorizedResponse(message: string = "Unauthorized"): NextResponse<ApiErrorResponse> {
	return errorResponse("UNAUTHORIZED", message, 401);
}

export function forbiddenResponse(message: string = "Forbidden"): NextResponse<ApiErrorResponse> {
	return errorResponse("FORBIDDEN", message, 403);
}

export function conflictResponse(message: string = "Conflict"): NextResponse<ApiErrorResponse> {
	return errorResponse("CONFLICT", message, 409);
}

export function serverErrorResponse(message: string = "Internal server error"): NextResponse<ApiErrorResponse> {
	return errorResponse("INTERNAL_SERVER_ERROR", message, 500);
}

