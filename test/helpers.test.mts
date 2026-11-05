import { createHmac } from 'crypto';
import { describe, expect, it } from 'vitest';

import { buildBulkMessages, splitRecipients } from '../nodes/Textbee/shared/bulk';
import { baseUrlExpression, normalizeBaseUrl } from '../nodes/Textbee/shared/baseUrl';
import { computeSignature, verifySignature } from '../nodes/Textbee/shared/signature';
import { isNotFoundError, planSubscription } from '../nodes/Textbee/shared/subscription';
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

describe('stripSecrets', () => {
	it('removes signing secrets and push tokens, top level and nested', () => {
		const [item] = stripSecrets([
			{
				json: {
					_id: 'x',
					signingSecret: 's',
					webhookSubscriptionData: { name: 'n', signingSecret: 's' },
					deviceData: { model: 'Pixel', fcmToken: 't' },
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
