import type { INodeProperties } from 'n8n-workflow';

import { bulkMessagesPreSend } from '../../shared/bulk';
import { requireObjectIds } from '../../shared/validation';
import { deviceIdProperty, unwrapDataPostReceive } from '../../shared/descriptions';

const showOnlyForMessageSendBulk = {
	operation: ['sendBulk'],
	resource: ['message'],
};

export const messageSendBulkDescription: INodeProperties[] = [
	{
		displayName: 'Messages',
		name: 'messages',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		placeholder: 'Add Message',
		default: {},
		required: true,
		displayOptions: {
			show: showOnlyForMessageSendBulk,
		},
		options: [
			{
				displayName: 'Message',
				name: 'messageValues',
				values: [
					{
						displayName: 'Message',
						name: 'message',
						type: 'string',
						typeOptions: {
							rows: 3,
						},
						default: '',
						required: true,
						description: 'Text of this SMS entry',
					},
					{
						displayName: 'Recipients',
						name: 'recipients',
						type: 'string',
						default: '',
						required: true,
						placeholder: '+12015550123',
						description: 'Phone numbers or short codes, comma-separated. International format, for example +15555550123, reaches any country.',
					},
					{
						displayName: 'SIM Subscription ID',
						name: 'simSubscriptionId',
						type: 'number',
						default: 0,
						description:
							'SIM subscription ID for this entry. Leave at 0 to use the device default SIM.',
					},
					{
						displayName: 'Scheduled At',
						name: 'scheduledAt',
						type: 'dateTime',
						default: '',
						description: 'Optional ISO schedule time (up to 72 hours ahead)',
					},
				],
			},
		],
	},
	{
		...deviceIdProperty,
		displayOptions: {
			show: showOnlyForMessageSendBulk,
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
		displayName: 'Message Template Label',
		name: 'messageTemplate',
		type: 'string',
		default: '',
		description: 'Optional label for the batch (not the SMS body)',
		displayOptions: {
			show: showOnlyForMessageSendBulk,
		},
		routing: {
			send: {
				type: 'body',
				property: 'messageTemplate',
			},
		},
	},
];

export const messageSendBulkRouting = {
	send: {
		preSend: [requireObjectIds('deviceId?'), bulkMessagesPreSend],
	},
	request: {
		method: 'POST' as const,
		url: '/gateway/send-bulk-sms',
	},
	output: {
		postReceive: unwrapDataPostReceive,
	},
};
