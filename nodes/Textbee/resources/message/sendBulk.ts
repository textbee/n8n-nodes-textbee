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
						displayName: 'Scheduled At',
						name: 'scheduledAt',
						type: 'dateTime',
						default: '',
						description: 'Optional ISO schedule time (up to 72 hours ahead)',
					},
					{
						displayName: 'SIM',
						name: 'simSlotIndex',
						type: 'options',
						options: [
							{
								name: 'Default (Phone Decides)',
								value: '',
								description: 'Do not choose a SIM. The phone uses its default SIM.',
							},
							{
								name: 'SIM 1',
								value: 0,
							},
							{
								name: 'SIM 2',
								value: 1,
							},
						],
						default: '',
						description: 'Which SIM sends the message, by its slot in the phone. Default lets the phone decide. If the slot has no active SIM, the message fails and is never sent from another SIM. You can also switch to Expression and return 0 for SIM 1 or 1 for SIM 2.',
					},
					{
						displayName: 'SIM Subscription ID (Older)',
						name: 'simSubscriptionId',
						type: 'number',
						default: 0,
						description: 'Older way to choose a SIM, by its Android subscription ID. Leave at 0 to skip it. The SIM option is preferred and wins when both are set.',
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
