export type WebhookSubscription = {
	_id: string;
	deliveryUrl: string;
	events?: string[];
	isActive?: boolean;
	signingSecret?: string;
};

export type DesiredSubscription = {
	deliveryUrl: string;
	events: string[];
	signingSecret: string;
};

export type SubscriptionPlan = 'keep' | 'update';

function sameEvents(a: string[], b: string[]): boolean {
	return [...a].sort().join(',') === [...b].sort().join(',');
}

/**
 * Decide what to do with a subscription the trigger already owns.
 * Anything that differs (paused, new URL, new events, rotated secret) is
 * patched in place, so the trigger never leaves an orphan behind.
 */
export function planSubscription(
	existing: WebhookSubscription,
	desired: DesiredSubscription,
): SubscriptionPlan {
	const matches =
		existing.isActive === true &&
		existing.deliveryUrl === desired.deliveryUrl &&
		sameEvents(existing.events ?? [], desired.events) &&
		existing.signingSecret === desired.signingSecret;

	return matches ? 'keep' : 'update';
}

/**
 * The credential secret wins when set, so 1.0.0 setups keep working.
 * Otherwise use the secret the trigger stored for its own subscription.
 */
export function resolveSigningSecret(
	credentialSecret: unknown,
	storedSecret: unknown,
): string | undefined {
	if (typeof credentialSecret === 'string' && credentialSecret !== '') return credentialSecret;
	if (typeof storedSecret === 'string' && storedSecret !== '') return storedSecret;
	return undefined;
}

/** True when an n8n HTTP helper error is a 404 from the API. */
export function isNotFoundError(error: unknown): boolean {
	if (typeof error !== 'object' || error === null) return false;
	const e = error as {
		httpCode?: unknown;
		statusCode?: unknown;
		response?: { status?: unknown };
		cause?: { response?: { status?: unknown }; status?: unknown };
	};
	const codes = [
		e.httpCode,
		e.statusCode,
		e.response?.status,
		e.cause?.response?.status,
		e.cause?.status,
	];
	return codes.some((code) => String(code) === '404');
}
