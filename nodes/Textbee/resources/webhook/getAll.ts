import type { INodeProperties } from 'n8n-workflow';

import { stripSecretsPostReceive } from '../../shared/validation';
import { unwrapDataPostReceive } from '../../shared/descriptions';

const showOnlyForWebhookGetMany = {
	operation: ['getAll'],
	resource: ['webhook'],
};

export const webhookGetManyDescription: INodeProperties[] = [
	{
		displayName: 'Lists webhook subscriptions on your account (deleted ones are excluded).',
		name: 'webhookListNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: showOnlyForWebhookGetMany,
		},
	},
];

export const webhookGetManyRouting = {
	request: {
		method: 'GET' as const,
		url: '/webhooks',
	},
	output: {
		postReceive: [...unwrapDataPostReceive, stripSecretsPostReceive],
	},
};
