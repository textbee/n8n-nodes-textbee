import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

/** Hex HMAC-SHA256 of the request body, the same digest textbee sends as X-Signature. */
export function computeSignature(body: Buffer | string, secret: string): string {
	return createHmac('sha256', secret).update(body).digest('hex');
}

/** Constant-time check of an X-Signature header against the body. */
export function verifySignature(
	body: Buffer | string,
	header: string | undefined,
	secret: string | undefined,
): boolean {
	if (!secret || !header) return false;
	return safeEqualHex(computeSignature(body, secret), header);
}

/** Default replay window for X-Textbee-Signature, in seconds. */
export const SIGNATURE_TOLERANCE_SECONDS = 300;

/**
 * Constant-time check of an X-Textbee-Signature header, `t=<unix seconds>,v1=<hex>`.
 * v1 is the HMAC-SHA256 of `<t>.<raw body>`. Several v1 entries are allowed and any
 * match passes. A timestamp more than `toleranceSeconds` from now is rejected, so a
 * captured request cannot be replayed later.
 */
export function verifyTimestampedSignature(
	body: Buffer | string,
	header: string | undefined,
	secret: string | undefined,
	nowSeconds: number,
	toleranceSeconds = SIGNATURE_TOLERANCE_SECONDS,
): boolean {
	if (!secret || !header) return false;

	let timestamp: string | undefined;
	const signatures: string[] = [];
	for (const part of header.split(',')) {
		const index = part.indexOf('=');
		if (index < 0) continue;
		const key = part.slice(0, index).trim();
		const value = part.slice(index + 1).trim();
		if (key === 't') {
			if (timestamp !== undefined) return false;
			timestamp = value;
		} else if (key === 'v1') {
			signatures.push(value);
		}
	}

	if (!timestamp || !/^\d{1,12}$/.test(timestamp) || signatures.length === 0) return false;
	if (Math.abs(nowSeconds - Number(timestamp)) > toleranceSeconds) return false;

	const expected = createHmac('sha256', secret).update(`${timestamp}.`).update(body).digest('hex');
	return signatures.some((signature) => safeEqualHex(expected, signature));
}

function safeEqualHex(expected: string, provided: string): boolean {
	const a = Buffer.from(expected, 'utf8');
	const b = Buffer.from(provided.trim().toLowerCase(), 'utf8');
	return a.length === b.length && timingSafeEqual(a, b);
}

/** New random signing secret: 32 bytes as 64 hex characters. */
export function generateSigningSecret(): string {
	return randomBytes(32).toString('hex');
}
