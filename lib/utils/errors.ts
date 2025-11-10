export class AuctionError extends Error {
	constructor(message: string, public code?: string) {
		super(message);
		this.name = "AuctionError";
	}
}

export class BidError extends Error {
	constructor(message: string, public code?: string) {
		super(message);
		this.name = "BidError";
	}
}

export class ValidationError extends Error {
	constructor(message: string, public code?: string) {
		super(message);
		this.name = "ValidationError";
	}
}

export class NotFoundError extends Error {
	constructor(message: string, public code?: string) {
		super(message);
		this.name = "NotFoundError";
	}
}

export class AuthorizationError extends Error {
	constructor(message: string, public code?: string) {
		super(message);
		this.name = "AuthorizationError";
	}
}

