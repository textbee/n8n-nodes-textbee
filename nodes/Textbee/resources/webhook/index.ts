import type { INodeProperties } from 'n8n-workflow';

import { webhookCreateDescription, webhookCreateRouting } from './create';
import { webhookDeleteDescription, webhookDeleteRouting } from './delete';
import { webhookGetDescription, webhookGetRouting } from './get';
import { webhookGetManyDescription, webhookGetManyRouting } from './getAll';
import {
	webhookGetNotificationsDescription,
	webhookGetNotificationsRouting,
} from './getNotifications';
import { webhookUpdateDescription, webhookUpdateRouting } from './update';

const showOnlyForWebhook = {
	resource: ['webhook'],
};

export const webhookDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForWebhook,
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create a webhook subscription',
				description: 'Create a webhook subscription',
				routing: webhookCreateRouting,
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a webhook subscription',
				description: 'Delete a webhook subscription',
				routing: webhookDeleteRouting,
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a webhook subscription',
				description: 'Get one webhook subscription',
				routing: webhookGetRouting,
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many webhook subscriptions',
				description: 'List webhook subscriptions',
				routing: webhookGetManyRouting,
			},
			{
				name: 'Get Notifications',
				value: 'getNotifications',
				action: 'Get webhook delivery attempts',
				description: 'List webhook delivery attempts',
				routing: webhookGetNotificationsRouting,
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a webhook subscription',
				description: 'Update a webhook subscription',
				routing: webhookUpdateRouting,
			},
		],
		default: 'getAll',
	},
	...webhookCreateDescription,
	...webhookDeleteDescription,
	...webhookGetDescription,
	...webhookGetManyDescription,
	...webhookGetNotificationsDescription,
	...webhookUpdateDescription,
];
