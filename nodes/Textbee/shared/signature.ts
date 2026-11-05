import { createHmac, timingSafeEqual } from 'crypto';

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

	const expected = Buffer.from(computeSignature(body, secret), 'utf8');
	const provided = Buffer.from(header.trim().toLowerCase(), 'utf8');

	return expected.length === provided.length && timingSafeEqual(expected, provided);
}
