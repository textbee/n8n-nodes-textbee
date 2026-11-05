import type { INodeProperties } from 'n8n-workflow';

import { requireObjectIds, stripSecretsPostReceive } from '../../shared/validation';
import { unwrapDataPostReceive } from '../../shared/descriptions';
import { eventOptions } from './create';

const showOnlyForWebhookUpdate = {
	operation: ['update'],
	resource: ['webhook'],
};

export const webhookUpdateDescription: INodeProperties[] = [
	{
		displayName: 'Webhook ID',
		name: 'webhookId',
		type: 'string',
		default: '',
		required: true,
		description: 'Subscription ID to update',
		displayOptions: {
			show: showOnlyForWebhookUpdate,
		},
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: showOnlyForWebhookUpdate,
		},
		options: [
			{
				displayName: 'Delivery URL',
				name: 'deliveryUrl',
				type: 'string',
				default: '',
				description: 'New delivery URL',
				routing: {
					send: {
						type: 'body',
						property: 'deliveryUrl',
					},
				},
			},
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				options: eventOptions,
				default: [],
				description: 'Replacement event list (cannot be empty when set)',
				routing: {
					send: {
						type: 'body',
						property: 'events',
					},
				},
			},
			{
				displayName: 'Is Active',
				name: 'isActive',
				type: 'boolean',
				default: true,
				description:
					'Whether deliveries are attempted. Set true to re-enable a paused subscription.',
				routing: {
					send: {
						type: 'body',
						property: 'isActive',
					},
				},
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'Label shown in the dashboard',
				routing: {
					send: {
						type: 'body',
						property: 'name',
					},
				},
			},
			{
				displayName: 'Signing Secret',
				name: 'signingSecret',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				description: 'New signing secret (at least 20 characters)',
				routing: {
					send: {
						type: 'body',
						property: 'signingSecret',
					},
				},
			},
		],
	},
];

export const webhookUpdateRouting = {
	send: {
		preSend: [requireObjectIds('webhookId')],
	},
	request: {
		method: 'PATCH' as const,
		url: '=/webhooks/{{$parameter.webhookId}}',
	},
	output: {
		postReceive: [...unwrapDataPostReceive, stripSecretsPostReceive],
	},
};
