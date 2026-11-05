import type { INodeProperties } from 'n8n-workflow';

import { requireObjectIds } from '../../shared/validation';
import { unwrapDataPostReceive } from '../../shared/descriptions';

const showOnlyForWebhookDelete = {
	operation: ['delete'],
	resource: ['webhook'],
};

export const webhookDeleteDescription: INodeProperties[] = [
	{
		displayName: 'Webhook ID',
		name: 'webhookId',
		type: 'string',
		default: '',
		required: true,
		description: 'Subscription ID to delete',
		displayOptions: {
			show: showOnlyForWebhookDelete,
		},
	},
];

export const webhookDeleteRouting = {
	send: {
		preSend: [requireObjectIds('webhookId')],
	},
	request: {
		method: 'DELETE' as const,
		url: '=/webhooks/{{$parameter.webhookId}}',
	},
	output: {
		postReceive: unwrapDataPostReceive,
	},
};
