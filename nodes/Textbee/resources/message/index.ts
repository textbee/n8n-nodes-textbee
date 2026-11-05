import type { INodeProperties } from 'n8n-workflow';

import { messageGetDescription, messageGetRouting } from './get';
import { messageGetManyDescription, messageGetManyRouting } from './getAll';
import { messageGetBatchDescription, messageGetBatchRouting } from './getBatch';
import { messageSendDescription, messageSendRouting } from './send';
import { messageSendBulkDescription, messageSendBulkRouting } from './sendBulk';

const showOnlyForMessage = {
	resource: ['message'],
};

export const messageDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForMessage,
		},
		options: [
			{
				name: 'Get',
				value: 'get',
				action: 'Get a message',
				description: 'Get one sent or received message by device and message ID',
				routing: messageGetRouting,
			},
			{
				name: 'Get Batch',
				value: 'getBatch',
				action: 'Get a send batch',
				description: 'Get a send batch and its per-recipient messages',
				routing: messageGetBatchRouting,
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many messages',
				description: 'List sent and received messages with filters and pagination',
				routing: messageGetManyRouting,
			},
			{
				name: 'Send',
				value: 'send',
				action: 'Send an SMS',
				description: 'Send one message to one or more recipients',
				routing: messageSendRouting,
			},
			{
				name: 'Send Bulk',
				value: 'sendBulk',
				action: 'Send bulk SMS',
				description: 'Send several messages with their own text and recipients in one call',
				routing: messageSendBulkRouting,
			},
		],
		default: 'send',
	},
	...messageSendDescription,
	...messageSendBulkDescription,
	...messageGetManyDescription,
	...messageGetDescription,
	...messageGetBatchDescription,
];
