import { createHmac } from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TextbeeTrigger } from '../nodes/TextbeeTrigger/TextbeeTrigger.node';

const SECRET = 'a-signing-secret-of-enough-length';
const STORED = 'b'.repeat(64);
const URL = 'https://n8n.example.com/webhook/abc/webhook';
const ID = '664a9b8cd0e1f2a3b4c5d6e7';
const OTHER_ID = '664a9b8cd0e1f2a3b4c5d6e8';

type Call = { method: string; url: string; body?: unknown };

function notFound() {
	return Object.assign(new Error('Not Found'), { response: { status: 404 } });
}

function makeContext(options: {
	staticData?: Record<string, unknown>;
	events?: string[];
	secret?: string;
	workflowName?: string;
	respond: (call: Call) => unknown;
}) {
	const staticData = options.staticData ?? {};
	const calls: Call[] = [];
	const context = {
		getWorkflowStaticData: () => staticData,
		getNodeWebhookUrl: () => URL,
		getNodeParameter: (name: string) =>
			name === 'events' ? (options.events ?? ['MESSAGE_RECEIVED']) : undefined,
		getCredentials: async () => ({
			apiKey: 'key',
			baseUrl: 'https://api.textbee.dev',
			webhookSigningSecret: 'secret' in options ? options.secret : SECRET,
		}),
		getNode: () => ({
			name: 'textbee Trigger',
			type: 'textbeeTrigger',
			typeVersion: 1,
			position: [0, 0],
			parameters: {},
		}),
		getWorkflow: () => ({ name: options.workflowName ?? 'Inbound SMS' }),
		helpers: {
			httpRequestWithAuthentication: vi.fn(
				async (_cred: string, req: { method: string; url: string; body?: unknown }) => {
					const call = { method: req.method, url: req.url, body: req.body };
					calls.push(call);
					return options.respond(call);
				},
			),
		},
	};
	return { context, calls, staticData };
}

const subscription = {
	_id: ID,
	isActive: true,
	deliveryUrl: URL,
	events: ['MESSAGE_RECEIVED'],
	signingSecret: SECRET,
};

const hooks = new TextbeeTrigger().webhookMethods.default;

describe('checkExists', () => {
	it('returns false with no stored id and makes no request', async () => {
		const { context, calls } = makeContext({ respond: () => ({}) });
		expect(await hooks.checkExists.call(context as never)).toBe(false);
		expect(calls).toHaveLength(0);
	});

	it('returns true for a matching subscription', async () => {
		const { context } = makeContext({
			staticData: { webhookId: ID },
			respond: () => ({ data: subscription }),
		});
		expect(await hooks.checkExists.call(context as never)).toBe(true);
	});

	it('keeps the id on a mismatch so create can patch it', async () => {
		const { context, staticData } = makeContext({
			staticData: { webhookId: ID },
			respond: () => ({ data: { ...subscription, isActive: false } }),
		});
		expect(await hooks.checkExists.call(context as never)).toBe(false);
		expect(staticData.webhookId).toBe(ID);
	});

	it('drops the id only on a 404', async () => {
		const { context, staticData } = makeContext({
			staticData: { webhookId: ID },
			respond: () => {
				throw notFound();
			},
		});
		expect(await hooks.checkExists.call(context as never)).toBe(false);
		expect(staticData.webhookId).toBeUndefined();
	});

	it('needs an update when no credential secret and no stored secret exist', async () => {
		const { context, staticData } = makeContext({
			secret: '',
			staticData: { webhookId: ID },
			respond: () => ({ data: subscription }),
		});
		expect(await hooks.checkExists.call(context as never)).toBe(false);
		expect(staticData.webhookId).toBe(ID);
		expect(staticData.signingSecret).toBeUndefined();
	});

	it('matches a subscription that uses the stored secret', async () => {
		const { context } = makeContext({
			secret: '',
			staticData: { webhookId: ID, signingSecret: STORED },
			respond: () => ({ data: { ...subscription, signingSecret: STORED } }),
		});
		expect(await hooks.checkExists.call(context as never)).toBe(true);
	});

	it('refreshes the signature version from the API', async () => {
		const { context, staticData } = makeContext({
			staticData: { webhookId: ID },
			respond: () => ({ data: { ...subscription, signatureVersion: 2 } }),
		});
		await hooks.checkExists.call(context as never);
		expect(staticData.signatureVersion).toBe(2);

		const older = makeContext({
			staticData: { webhookId: ID, signatureVersion: 2 },
			respond: () => ({ data: subscription }),
		});
		await hooks.checkExists.call(older.context as never);
		expect(older.staticData.signatureVersion).toBeUndefined();
	});

	it('rethrows other errors and keeps the id', async () => {
		const { context, staticData } = makeContext({
			staticData: { webhookId: ID },
			respond: () => {
				throw Object.assign(new Error('Bad Gateway'), { response: { status: 502 } });
			},
		});
		await expect(hooks.checkExists.call(context as never)).rejects.toThrow();
		expect(staticData.webhookId).toBe(ID);
	});
});

describe('create', () => {
	it('rejects a short signing secret before any request', async () => {
		const { context, calls } = makeContext({ secret: 'short', respond: () => ({}) });
		await expect(hooks.create.call(context as never)).rejects.toThrow(/at least 20 characters/);
		expect(calls).toHaveLength(0);
	});

	it('patches the stored subscription instead of creating a new one', async () => {
		const { context, calls, staticData } = makeContext({
			staticData: { webhookId: ID },
			respond: () => ({ data: subscription }),
		});
		expect(await hooks.create.call(context as never)).toBe(true);
		expect(calls).toEqual([
			{
				method: 'PATCH',
				url: `/webhooks/${ID}`,
				body: {
					name: 'n8n: Inbound SMS (n8n.example.com)',
					deliveryUrl: URL,
					events: ['MESSAGE_RECEIVED'],
					signingSecret: SECRET,
					isActive: true,
				},
			},
		]);
		expect(staticData.webhookId).toBe(ID);
	});

	it('reuses a subscription with the same URL when the stored one is gone', async () => {
		const { context, calls, staticData } = makeContext({
			staticData: { webhookId: ID },
			respond: (call) => {
				if (call.method === 'PATCH' && call.url === `/webhooks/${ID}`) throw notFound();
				if (call.method === 'GET') return { data: [{ ...subscription, _id: OTHER_ID }] };
				return { data: subscription };
			},
		});
		expect(await hooks.create.call(context as never)).toBe(true);
		expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
			`PATCH /webhooks/${ID}`,
			'GET /webhooks',
			`PATCH /webhooks/${OTHER_ID}`,
		]);
		expect(staticData.webhookId).toBe(OTHER_ID);
	});

	it('generates and stores a secret when the credential secret is empty', async () => {
		const { context, calls, staticData } = makeContext({
			secret: '',
			respond: (call) =>
				call.method === 'GET' ? { data: [] } : { data: { ...subscription, _id: OTHER_ID } },
		});
		expect(await hooks.create.call(context as never)).toBe(true);
		const post = calls.find((c) => c.method === 'POST')?.body as { signingSecret: string };
		expect(post.signingSecret).toMatch(/^[a-f0-9]{64}$/);
		expect(staticData.signingSecret).toBe(post.signingSecret);
		expect(staticData.webhookId).toBe(OTHER_ID);
	});

	it('patches with the stored secret when the credential secret is empty', async () => {
		const { context, calls, staticData } = makeContext({
			secret: '',
			staticData: { webhookId: ID, signingSecret: STORED },
			respond: () => ({ data: subscription }),
		});
		await hooks.create.call(context as never);
		expect(calls).toHaveLength(1);
		expect(calls[0].body).toMatchObject({ signingSecret: STORED });
		expect(staticData.signingSecret).toBe(STORED);
	});

	it('uses the credential secret over a stored one', async () => {
		const { context, calls } = makeContext({
			staticData: { webhookId: ID, signingSecret: STORED },
			respond: () => ({ data: subscription }),
		});
		await hooks.create.call(context as never);
		expect(calls[0].body).toMatchObject({ signingSecret: SECRET });
	});

	it('stores signature version 2 when the API reports it', async () => {
		const created = makeContext({
			respond: (call) =>
				call.method === 'GET'
					? { data: [] }
					: { data: { ...subscription, _id: OTHER_ID, signatureVersion: 2 } },
		});
		await hooks.create.call(created.context as never);
		expect(created.staticData.signatureVersion).toBe(2);

		const patched = makeContext({
			staticData: { webhookId: ID },
			respond: () => ({ data: { ...subscription, signatureVersion: 2 } }),
		});
		await hooks.create.call(patched.context as never);
		expect(patched.staticData.signatureVersion).toBe(2);

		const older = makeContext({
			staticData: { webhookId: ID, signatureVersion: 2 },
			respond: () => ({ data: subscription }),
		});
		await hooks.create.call(older.context as never);
		expect(older.staticData.signatureVersion).toBeUndefined();
	});

	it('shortens a long workflow name and keeps the host', async () => {
		const { context, calls } = makeContext({
			workflowName: 'Forward every inbound SMS to the support team channel and log it',
			staticData: { webhookId: ID },
			respond: () => ({ data: subscription }),
		});
		await hooks.create.call(context as never);
		const name = (calls[0].body as { name: string }).name;
		expect(name.length).toBeLessThanOrEqual(64);
		expect(name).toMatch(/^n8n: Forward every inbound SMS .* \(n8n\.example\.com\)$/);
	});

	it('creates a subscription when none exists', async () => {
		const { context, calls, staticData } = makeContext({
			respond: (call) =>
				call.method === 'GET' ? { data: [] } : { data: { ...subscription, _id: OTHER_ID } },
		});
		expect(await hooks.create.call(context as never)).toBe(true);
		expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual(['GET /webhooks', 'POST /webhooks']);
		expect(staticData.webhookId).toBe(OTHER_ID);
	});
});

describe('delete', () => {
	it('treats a 404 as already deleted', async () => {
		const { context, staticData } = makeContext({
			staticData: { webhookId: ID },
			respond: () => {
				throw notFound();
			},
		});
		expect(await hooks.delete.call(context as never)).toBe(true);
		expect(staticData.webhookId).toBeUndefined();
	});

	it('clears the stored secret and signature version', async () => {
		const { context, staticData } = makeContext({
			staticData: { webhookId: ID, signingSecret: STORED, signatureVersion: 2 },
			respond: () => ({}),
		});
		expect(await hooks.delete.call(context as never)).toBe(true);
		expect(staticData).toEqual({});
	});

	it('surfaces other failures and keeps the id', async () => {
		const { context, staticData } = makeContext({
			staticData: { webhookId: ID },
			respond: () => {
				throw Object.assign(new Error('Server Error'), { response: { status: 500 } });
			},
		});
		await expect(hooks.delete.call(context as never)).rejects.toThrow();
		expect(staticData.webhookId).toBe(ID);
	});
});

describe('webhook', () => {
	let status: ReturnType<typeof vi.fn>;
	let json: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		json = vi.fn();
		status = vi.fn(() => ({ json }));
	});

	function delivery(
		payload: Record<string, unknown>,
		signature?: string,
		staticData: Record<string, unknown> = { webhookId: ID },
	) {
		const raw = Buffer.from(JSON.stringify(payload));
		const sig = signature ?? createHmac('sha256', SECRET).update(raw).digest('hex');
		return {
			getCredentials: async () => ({ webhookSigningSecret: SECRET }),
			getHeaderData: () => ({ 'x-signature': sig }),
			getRequestObject: () => ({ rawBody: raw }),
			getResponseObject: () => ({ status }),
			getBodyData: () => payload,
			getWorkflowStaticData: () => staticData,
			getNodeParameter: () => ['MESSAGE_RECEIVED'],
			helpers: { returnJsonArray: (items: unknown[]) => items.map((j) => ({ json: j })) },
		};
	}

	const received = { webhookEvent: 'MESSAGE_RECEIVED', webhookSubscriptionId: ID, message: 'Hi' };
	const trigger = new TextbeeTrigger();

	it('starts the workflow for a valid delivery', async () => {
		const result = await trigger.webhook.call(delivery(received) as never);
		expect(result.workflowData?.[0][0].json).toEqual(received);
	});

	it('rejects a bad signature with 401', async () => {
		const result = await trigger.webhook.call(delivery(received, 'deadbeef') as never);
		expect(result).toEqual({ noWebhookResponse: true });
		expect(status).toHaveBeenCalledWith(401);
	});

	it('rejects a delivery signed for another subscription', async () => {
		const result = await trigger.webhook.call(
			delivery({ ...received, webhookSubscriptionId: OTHER_ID }) as never,
		);
		expect(result).toEqual({ noWebhookResponse: true });
		expect(status).toHaveBeenCalledWith(401);
	});

	function deliver(options: {
		credentialSecret?: string;
		staticData?: Record<string, unknown>;
		headers: (raw: Buffer) => Record<string, string>;
	}) {
		const raw = Buffer.from(JSON.stringify(received));
		return {
			getCredentials: async () => ({ webhookSigningSecret: options.credentialSecret ?? '' }),
			getHeaderData: () => options.headers(raw),
			getRequestObject: () => ({ rawBody: raw }),
			getResponseObject: () => ({ status }),
			getBodyData: () => received,
			getWorkflowStaticData: () => options.staticData ?? { webhookId: ID },
			getNodeParameter: () => ['MESSAGE_RECEIVED'],
			helpers: { returnJsonArray: (items: unknown[]) => items.map((j) => ({ json: j })) },
		};
	}

	const legacy = (secret: string) => (raw: Buffer) => ({
		'x-signature': createHmac('sha256', secret).update(raw).digest('hex'),
	});

	function timestamped(secret: string, offsetSeconds = 0, withLegacy = true) {
		return (raw: Buffer) => {
			const t = Math.floor(Date.now() / 1000) + offsetSeconds;
			const v1 = createHmac('sha256', secret).update(`${t}.`).update(raw).digest('hex');
			return {
				...(withLegacy ? legacy(secret)(raw) : {}),
				'x-textbee-timestamp': String(t),
				'x-textbee-signature': `t=${t},v1=${v1}`,
			};
		};
	}

	async function expectAccepted(context: unknown) {
		const result = await trigger.webhook.call(context as never);
		expect(result.workflowData?.[0][0].json).toEqual(received);
	}

	async function expectRejected(context: unknown) {
		const result = await trigger.webhook.call(context as never);
		expect(result).toEqual({ noWebhookResponse: true });
		expect(status).toHaveBeenCalledWith(401);
	}

	it('verifies with the stored secret when the credential secret is empty', async () => {
		const staticData = { webhookId: ID, signingSecret: STORED };
		await expectAccepted(deliver({ staticData, headers: legacy(STORED) }));
		await expectRejected(deliver({ staticData, headers: legacy(SECRET) }));
	});

	it('verifies with the credential secret when it is set', async () => {
		const staticData = { webhookId: ID, signingSecret: STORED };
		await expectAccepted(
			deliver({ credentialSecret: SECRET, staticData, headers: legacy(SECRET) }),
		);
		await expectRejected(
			deliver({ credentialSecret: SECRET, staticData, headers: legacy(STORED) }),
		);
	});

	it('rejects every delivery when no secret exists', async () => {
		await expectRejected(deliver({ headers: legacy('') }));
		await expectRejected(deliver({ headers: timestamped('') }));
	});

	describe('with signature version 2', () => {
		const staticData = { webhookId: ID, signatureVersion: 2 };

		it('accepts a valid timestamped signature', async () => {
			await expectAccepted(
				deliver({ credentialSecret: SECRET, staticData, headers: timestamped(SECRET, 0, false) }),
			);
		});

		it('rejects a legacy signature alone', async () => {
			await expectRejected(
				deliver({ credentialSecret: SECRET, staticData, headers: legacy(SECRET) }),
			);
		});

		it('rejects an expired or wrongly signed timestamped signature', async () => {
			await expectRejected(
				deliver({ credentialSecret: SECRET, staticData, headers: timestamped(SECRET, -301) }),
			);
			await expectRejected(
				deliver({ credentialSecret: SECRET, staticData, headers: timestamped(STORED) }),
			);
		});
	});

	describe('with an older API', () => {
		it('accepts the legacy signature', async () => {
			await expectAccepted(deliver({ credentialSecret: SECRET, headers: legacy(SECRET) }));
		});

		it('verifies a timestamped signature instead when present', async () => {
			await expectAccepted(deliver({ credentialSecret: SECRET, headers: timestamped(SECRET) }));
			await expectRejected(
				deliver({
					credentialSecret: SECRET,
					headers: (raw) => ({ ...legacy(SECRET)(raw), 'x-textbee-signature': 't=1,v1=00' }),
				}),
			);
		});
	});

	it('acknowledges unselected or missing events without starting a run', async () => {
		expect(
			await trigger.webhook.call(delivery({ ...received, webhookEvent: 'MESSAGE_SENT' }) as never),
		).toEqual({});
		expect(await trigger.webhook.call(delivery({ webhookSubscriptionId: ID }) as never)).toEqual(
			{},
		);
	});
});
