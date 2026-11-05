import type { INodeProperties } from 'n8n-workflow';

import { requireObjectIds } from '../../shared/validation';
import { deviceIdProperty, unwrapDataPostReceive } from '../../shared/descriptions';

const showOnlyForMessageSend = {
	operation: ['send'],
	resource: ['message'],
};

export const messageSendDescription: INodeProperties[] = [
	{
		displayName: 'Message',
		name: 'message',
		type: 'string',
		typeOptions: {
			rows: 4,
		},
		default: '',
		required: true,
		description: 'Text of the SMS. Long messages are split into segments by the carrier.',
		displayOptions: {
			show: showOnlyForMessageSend,
		},
		routing: {
			send: {
				type: 'body',
				property: 'message',
			},
		},
	},
	{
		displayName: 'Recipients',
		name: 'recipients',
		type: 'string',
		default: '',
		required: true,
		placeholder: '+12015550123, +12015550124',
		description:
			'Phone numbers in E.164 format. Separate multiple recipients with commas. Each recipient counts as one message against your plan.',
		displayOptions: {
			show: showOnlyForMessageSend,
		},
		routing: {
			send: {
				type: 'body',
				property: 'recipients',
				value: '={{ String($value).split(/[,\\n]/).map((r) => r.trim()).filter(Boolean) }}',
			},
		},
	},
	{
		...deviceIdProperty,
		displayOptions: {
			show: showOnlyForMessageSend,
		},
		routing: {
			send: {
				type: 'body',
				property: 'deviceId',
				value: '={{ $value && $value.value ? $value.value : undefined }}',
			},
		},
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: showOnlyForMessageSend,
		},
		options: [
			{
				displayName: 'SIM Subscription ID',
				name: 'simSubscriptionId',
				type: 'number',
				default: 0,
				description:
					'SIM to send from (subscriptionId from the device simInfo). Defaults to the device default SIM. IDs can change after a SIM swap.',
				routing: {
					send: {
						type: 'body',
						property: 'simSubscriptionId',
					},
				},
			},
			{
				displayName: 'Scheduled At',
				name: 'scheduledAt',
				type: 'dateTime',
				default: '',
				description:
					'ISO 8601 time to send the message (must be in the future, up to 72 hours ahead). Omit to send now.',
				routing: {
					send: {
						type: 'body',
						property: 'scheduledAt',
						value: '={{ $value ? new Date($value).toISOString() : undefined }}',
					},
				},
			},
		],
	},
	{
		displayName:
			'A 200 response means textbee accepted and queued the message. It is not a delivery confirmation. Use Get Batch or List with smsBatchId to follow status.',
		name: 'sendNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: showOnlyForMessageSend,
		},
	},
];

export const messageSendRouting = {
	send: {
		preSend: [requireObjectIds('deviceId?')],
	},
	request: {
		method: 'POST' as const,
		url: '/gateway/send-sms',
	},
	output: {
		postReceive: unwrapDataPostReceive,
	},
};
