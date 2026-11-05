import type { INodeProperties } from 'n8n-workflow';

import { stripSecretsPostReceive } from '../../shared/validation';
import { unwrapDataPostReceive } from '../../shared/descriptions';

const showOnlyForWebhookCreate = {
	operation: ['create'],
	resource: ['webhook'],
};

const eventOptions = [
	{ name: 'Message Delivered', value: 'MESSAGE_DELIVERED' },
	{ name: 'Message Failed', value: 'MESSAGE_FAILED' },
	{ name: 'Message Received', value: 'MESSAGE_RECEIVED' },
	{ name: 'Message Sent', value: 'MESSAGE_SENT' },
	{ name: 'Unknown State', value: 'UNKNOWN_STATE' },
];

export const webhookCreateDescription: INodeProperties[] = [
	{
		displayName: 'Delivery URL',
		name: 'deliveryUrl',
		type: 'string',
		default: '',
		required: true,
		description:
			'Public http(s) URL that receives POSTs. Private and loopback hosts are rejected by textbee.',
		displayOptions: {
			show: showOnlyForWebhookCreate,
		},
		routing: {
			send: {
				type: 'body',
				property: 'deliveryUrl',
			},
		},
	},
	{
		displayName: 'Signing Secret',
		name: 'signingSecret',
		type: 'string',
		typeOptions: { password: true },
		default: '',
		required: true,
		description: 'Shared secret, at least 20 characters. textbee signs each delivery with it.',
		displayOptions: {
			show: showOnlyForWebhookCreate,
		},
		routing: {
			send: {
				type: 'body',
				property: 'signingSecret',
			},
		},
	},
	{
		displayName: 'Events',
		name: 'events',
		type: 'multiOptions',
		options: eventOptions,
		default: ['MESSAGE_RECEIVED'],
		required: true,
		description: 'Events to deliver',
		displayOptions: {
			show: showOnlyForWebhookCreate,
		},
		routing: {
			send: {
				type: 'body',
				property: 'events',
			},
		},
	},
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		description: 'Label shown in the dashboard (up to 64 characters)',
		displayOptions: {
			show: showOnlyForWebhookCreate,
		},
		routing: {
			send: {
				type: 'body',
				property: 'name',
			},
		},
	},
];

export const webhookCreateRouting = {
	request: {
		method: 'POST' as const,
		url: '/webhooks',
	},
	output: {
		postReceive: [...unwrapDataPostReceive, stripSecretsPostReceive],
	},
};

export { eventOptions };
