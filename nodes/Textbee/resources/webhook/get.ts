import type { INodeProperties } from 'n8n-workflow';

import { requireObjectIds, stripSecretsPostReceive } from '../../shared/validation';
import { unwrapDataPostReceive } from '../../shared/descriptions';

const showOnlyForWebhookGet = {
	operation: ['get'],
	resource: ['webhook'],
};

export const webhookGetDescription: INodeProperties[] = [
	{
		displayName: 'Webhook ID',
		name: 'webhookId',
		type: 'string',
		default: '',
		required: true,
		description: 'Subscription ID from GET /webhooks',
		displayOptions: {
			show: showOnlyForWebhookGet,
		},
	},
];

export const webhookGetRouting = {
	send: {
		preSend: [requireObjectIds('webhookId')],
	},
	request: {
		method: 'GET' as const,
		url: '=/webhooks/{{$parameter.webhookId}}',
	},
	output: {
		postReceive: [...unwrapDataPostReceive, stripSecretsPostReceive],
	},
};
