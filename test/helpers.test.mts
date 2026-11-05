import { createHmac } from 'crypto';
import { describe, expect, it } from 'vitest';

import {
	InvalidScheduleError,
	buildBulkMessages,
	splitRecipients,
} from '../nodes/Textbee/shared/bulk';
import { baseUrlExpression, normalizeBaseUrl } from '../nodes/Textbee/shared/baseUrl';
import {
	computeSignature,
	generateSigningSecret,
	verifySignature,
	verifyTimestampedSignature,
} from '../nodes/Textbee/shared/signature';
import {
	isNotFoundError,
	planSubscription,
	resolveSigningSecret,
	subscriptionName,
} from '../nodes/Textbee/shared/subscription';
import { isObjectId, stripSecrets } from '../nodes/Textbee/shared/validation';

describe('normalizeBaseUrl', () => {
	const cases: Array<[string, string]> = [
		['', 'https://api.textbee.dev/api/v1'],
		['   ', 'https://api.textbee.dev/api/v1'],
		['https://api.textbee.dev', 'https://api.textbee.dev/api/v1'],
		['https://api.textbee.dev/', 'https://api.textbee.dev/api/v1'],
		['https://api.textbee.dev///', 'https://api.textbee.dev/api/v1'],
		['https://api.textbee.dev/api/v1', 'https://api.textbee.dev/api/v1'],
		['https://api.textbee.dev/api/v1/', 'https://api.textbee.dev/api/v1'],
		['https://api.textbee.dev/api/v1/gateway', 'https://api.textbee.dev/api/v1'],
		['https://sms.example.com/textbee', 'https://sms.example.com/textbee/api/v1'],
		['http://192.168.1.10:3001', 'http://192.168.1.10:3001/api/v1'],
	];

	it.each(cases)('normalizes %j', (input, expected) => {
		expect(normalizeBaseUrl(input)).toBe(expected);
	});

	it('matches the credential expression for every case', () => {
		const body = baseUrlExpression.replace(/^=\{\{/, '').replace(/\}\}$/, '');
		const evaluate = new Function('$credentials', `return ${body};`) as (c: {
			baseUrl: string;
		}) => string;
		for (const [input, expected] of cases) {
			expect(evaluate({ baseUrl: input })).toBe(expected);
		}
	});
});

describe('signature', () => {
	const secret = 'a-signing-secret-of-enough-length';
	const payload = { smsId: '664a9b8cd0e1f2a3b4c5d6e7', webhookEvent: 'MESSAGE_RECEIVED' };
	// The textbee API signs JSON.stringify(payload) and axios sends the same bytes.
	const body = Buffer.from(JSON.stringify(payload));
	const apiSignature = createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');

	it('computes the same digest as the textbee API', () => {
		expect(computeSignature(body, secret)).toBe(apiSignature);
	});

	it('accepts a valid signature, also in upper case or padded', () => {
		expect(verifySignature(body, apiSignature, secret)).toBe(true);
		expect(verifySignature(body, ` ${apiSignature.toUpperCase()} `, secret)).toBe(true);
	});

	it('rejects a wrong secret, a tampered body, and bad headers', () => {
		expect(verifySignature(body, apiSignature, 'another-secret-of-enough-length')).toBe(false);
		expect(verifySignature(Buffer.from('{"tampered":true}'), apiSignature, secret)).toBe(false);
		expect(verifySignature(body, undefined, secret)).toBe(false);
		expect(verifySignature(body, 'abc', secret)).toBe(false);
		expect(verifySignature(body, apiSignature, '')).toBe(false);
		expect(verifySignature(body, apiSignature, undefined)).toBe(false);
	});
});

describe('timestamped signature', () => {
	const secret = 'a-signing-secret-of-enough-length';
	const body = Buffer.from(JSON.stringify({ webhookEvent: 'MESSAGE_RECEIVED' }));
	const now = 1_793_000_000;
	const sign = (t: number, key = secret) =>
		createHmac('sha256', key).update(`${t}.`).update(body).digest('hex');
	const header = (t: number, ...v1: string[]) => [`t=${t}`, ...v1.map((v) => `v1=${v}`)].join(',');

	it('accepts a valid signature inside the tolerance', () => {
		expect(verifyTimestampedSignature(body, header(now, sign(now)), secret, now)).toBe(true);
		expect(verifyTimestampedSignature(body, header(now - 300, sign(now - 300)), secret, now)).toBe(
			true,
		);
		expect(verifyTimestampedSignature(body, header(now + 300, sign(now + 300)), secret, now)).toBe(
			true,
		);
		expect(
			verifyTimestampedSignature(body, ` t=${now} , v1=${sign(now).toUpperCase()} `, secret, now),
		).toBe(true);
	});

	it('rejects a timestamp more than 300 seconds away', () => {
		expect(verifyTimestampedSignature(body, header(now - 301, sign(now - 301)), secret, now)).toBe(
			false,
		);
		expect(verifyTimestampedSignature(body, header(now + 301, sign(now + 301)), secret, now)).toBe(
			false,
		);
		expect(
			verifyTimestampedSignature(body, header(now - 301, sign(now - 301)), secret, now, 600),
		).toBe(true);
	});

	it('rejects a wrong secret, a tampered body, and a signature for another timestamp', () => {
		const other = 'another-secret-of-enough-length';
		expect(verifyTimestampedSignature(body, header(now, sign(now, other)), secret, now)).toBe(
			false,
		);
		expect(
			verifyTimestampedSignature(
				Buffer.from('{"tampered":true}'),
				header(now, sign(now)),
				secret,
				now,
			),
		).toBe(false);
		expect(verifyTimestampedSignature(body, header(now, sign(now - 1)), secret, now)).toBe(false);
		expect(verifyTimestampedSignature(body, header(now, sign(now)), '', now)).toBe(false);
		expect(verifyTimestampedSignature(body, header(now, sign(now)), undefined, now)).toBe(false);
	});

	it.each([
		['missing', undefined],
		['empty', ''],
		['no timestamp', `v1=${'a'.repeat(64)}`],
		['no v1', `t=${now}`],
		['non-numeric timestamp', `t=abc,v1=${'a'.repeat(64)}`],
		['negative timestamp', `t=-${now},v1=${'a'.repeat(64)}`],
		['two timestamps', `t=${now},t=${now},v1=${'a'.repeat(64)}`],
		['garbage', 'not a signature header'],
	])('rejects a malformed header: %s', (_label, value) => {
		expect(verifyTimestampedSignature(body, value, secret, now)).toBe(false);
	});

	it('accepts any matching v1 among several and ignores unknown schemes', () => {
		expect(verifyTimestampedSignature(body, header(now, 'deadbeef', sign(now)), secret, now)).toBe(
			true,
		);
		expect(verifyTimestampedSignature(body, `t=${now},v0=abc,v1=${sign(now)}`, secret, now)).toBe(
			true,
		);
		expect(verifyTimestampedSignature(body, header(now, 'deadbeef', 'cafe'), secret, now)).toBe(
			false,
		);
	});

	it('also works with a string body', () => {
		expect(verifyTimestampedSignature(body.toString(), header(now, sign(now)), secret, now)).toBe(
			true,
		);
	});
});

describe('generateSigningSecret', () => {
	it('returns 64 random hex characters', () => {
		const a = generateSigningSecret();
		expect(a).toMatch(/^[a-f0-9]{64}$/);
		expect(generateSigningSecret()).not.toBe(a);
	});
});

describe('resolveSigningSecret', () => {
	it('prefers the credential secret, then the stored one', () => {
		expect(resolveSigningSecret('credential-secret', 'stored')).toBe('credential-secret');
		expect(resolveSigningSecret('', 'stored')).toBe('stored');
		expect(resolveSigningSecret(undefined, 'stored')).toBe('stored');
		expect(resolveSigningSecret('', '')).toBeUndefined();
		expect(resolveSigningSecret(undefined, undefined)).toBeUndefined();
	});
});

describe('subscriptionName', () => {
	const url = 'https://n8n.example.com/webhook/abc/webhook';

	it('adds the host of the delivery URL, with a port when set', () => {
		expect(subscriptionName('Inbound SMS', url)).toBe('n8n: Inbound SMS (n8n.example.com)');
		expect(subscriptionName('Inbound SMS', 'http://10.0.0.5:5678/webhook/x')).toBe(
			'n8n: Inbound SMS (10.0.0.5:5678)',
		);
	});

	it('shortens the workflow name first and stays within 64 characters', () => {
		const name = subscriptionName('A very long workflow name '.repeat(5), url);
		expect(name).toHaveLength(64);
		expect(name.startsWith('n8n: A very long workflow name')).toBe(true);
		expect(name.endsWith(' (n8n.example.com)')).toBe(true);
	});

	it('cuts the whole name when the host alone is too long', () => {
		const host = `${'h'.repeat(70)}.example.com`;
		const name = subscriptionName('Inbound SMS', `https://${host}/webhook/x`);
		expect(name).toHaveLength(64);
		expect(name.startsWith('n8n: Inbound SMS (hhh')).toBe(true);
	});

	it('falls back to the workflow name for an invalid URL', () => {
		expect(subscriptionName('Inbound SMS', 'not a url')).toBe('n8n: Inbound SMS');
		expect(subscriptionName('x'.repeat(80), 'not a url')).toHaveLength(64);
	});
});

describe('planSubscription', () => {
	const desired = {
		deliveryUrl: 'https://n8n.example.com/webhook/abc/webhook',
		events: ['MESSAGE_RECEIVED', 'MESSAGE_SENT'],
		signingSecret: 'a-signing-secret-of-enough-length',
	};
	const existing = {
		_id: '664a9b8cd0e1f2a3b4c5d6e7',
		isActive: true,
		deliveryUrl: desired.deliveryUrl,
		events: ['MESSAGE_SENT', 'MESSAGE_RECEIVED'],
		signingSecret: desired.signingSecret,
	};

	it('keeps a matching subscription regardless of event order', () => {
		expect(planSubscription(existing, desired)).toBe('keep');
	});

	it.each([
		['paused', { isActive: false }],
		['moved', { deliveryUrl: 'https://n8n.example.com/webhook/other' }],
		['different events', { events: ['MESSAGE_RECEIVED'] }],
		['rotated secret', { signingSecret: 'a-rotated-secret-of-enough-length' }],
	])('updates a %s subscription', (_label, change) => {
		expect(planSubscription({ ...existing, ...change }, desired)).toBe('update');
	});
});

describe('isNotFoundError', () => {
	it('detects 404 in the shapes n8n and axios use', () => {
		expect(isNotFoundError({ httpCode: '404' })).toBe(true);
		expect(isNotFoundError({ statusCode: 404 })).toBe(true);
		expect(isNotFoundError({ response: { status: 404 } })).toBe(true);
		expect(isNotFoundError({ cause: { response: { status: 404 } } })).toBe(true);
	});

	it('does not treat other errors as 404', () => {
		expect(isNotFoundError({ httpCode: '401' })).toBe(false);
		expect(isNotFoundError(new Error('socket hang up'))).toBe(false);
		expect(isNotFoundError(undefined)).toBe(false);
	});
});

describe('isObjectId', () => {
	it('accepts only 24-hex ids', () => {
		expect(isObjectId('664a9b8cd0e1f2a3b4c5d6e7')).toBe(true);
		expect(isObjectId('664A9B8CD0E1F2A3B4C5D6E7')).toBe(true);
		expect(isObjectId('../auth/api-keys/664a9b8cd0e1f2a3b4c5d6e7')).toBe(false);
		expect(isObjectId('664a9b8cd0e1f2a3b4c5d6e7?x=1')).toBe(false);
		expect(isObjectId('')).toBe(false);
		expect(isObjectId(123)).toBe(false);
	});
});

describe('bulk schedule validation', () => {
	it('names the entry with an invalid date', () => {
		expect(() =>
			buildBulkMessages([
				{ message: 'ok', recipients: '+15555550100' },
				{ message: 'bad', recipients: '+15555550101', scheduledAt: 'tomorrow-ish' },
			]),
		).toThrow(InvalidScheduleError);
	});
});

describe('stripSecrets', () => {
	it('removes signing secrets and push tokens, top level and nested', () => {
		const [item] = stripSecrets([
			{
				json: {
					_id: 'x',
					signingSecret: 's',
					webhookSubscriptionData: { name: 'n', signingSecret: 's' },
					deviceData: { model: 'Pixel', fcmToken: 't', serial: 'abc123' },
				},
			},
		]);
		expect(item.json).toEqual({
			_id: 'x',
			webhookSubscriptionData: { name: 'n' },
			deviceData: { model: 'Pixel' },
		});
	});
});

describe('bulk messages', () => {
	it('splits recipients on commas and newlines', () => {
		expect(splitRecipients(' +15555550100, +15555550101\n+15555550102,, ')).toEqual([
			'+15555550100',
			'+15555550101',
			'+15555550102',
		]);
		expect(splitRecipients(undefined)).toEqual([]);
	});

	it('builds the send-bulk-sms messages array', () => {
		expect(
			buildBulkMessages([
				{ message: 'Hi', recipients: '+15555550100', simSubscriptionId: 0, scheduledAt: '' },
				{
					message: 'Later',
					recipients: '+15555550101,+15555550102',
					simSubscriptionId: 2,
					scheduledAt: '2026-11-06T10:00:00+01:00',
				},
			]),
		).toEqual([
			{ message: 'Hi', recipients: ['+15555550100'] },
			{
				message: 'Later',
				recipients: ['+15555550101', '+15555550102'],
				simSubscriptionId: 2,
				scheduledAt: '2026-11-06T09:00:00.000Z',
			},
		]);
	});
});
