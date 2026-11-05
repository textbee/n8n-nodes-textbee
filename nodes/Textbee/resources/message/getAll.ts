import type { INodeProperties } from 'n8n-workflow';

import { unwrapDataPostReceive } from '../../shared/descriptions';

const showOnlyForMessageGetMany = {
	operation: ['getAll'],
	resource: ['message'],
};

export const messageGetManyDescription: INodeProperties[] = [
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		displayOptions: {
			show: showOnlyForMessageGetMany,
		},
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		routing: {
			send: {
				paginate: '={{ $value }}',
				type: 'query',
				property: 'limit',
				value: '100',
			},
			operations: {
				pagination: {
					type: 'generic',
					properties: {
						continue:
							'={{ Boolean($response.body?.meta?.hasMore && $response.body?.meta?.nextCursor) }}',
						request: {
							qs: {
								cursor: '={{ $response.body.meta.nextCursor }}',
								limit: 100,
							},
						},
					},
				},
			},
		},
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		displayOptions: {
			show: {
				...showOnlyForMessageGetMany,
				returnAll: [false],
			},
		},
		typeOptions: {
			minValue: 1,
			maxValue: 100,
		},
		default: 50,
		description: 'Max number of results to return',
		routing: {
			send: {
				type: 'query',
				property: 'limit',
			},
			output: {
				maxResults: '={{$value}}',
			},
		},
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: {
			show: showOnlyForMessageGetMany,
		},
		options: [
			{
				displayName: 'Cursor',
				name: 'cursor',
				type: 'string',
				default: '',
				description:
					'Opaque position from a previous response nextCursor. Switches to cursor pagination mode.',
				routing: {
					send: {
						type: 'query',
						property: 'cursor',
					},
				},
			},
			{
				displayName: 'Device IDs',
				name: 'deviceIds',
				type: 'string',
				default: '',
				description: 'Comma-separated device IDs to include',
				routing: {
					send: {
						type: 'query',
						property: 'deviceIds',
					},
				},
			},
			{
				displayName: 'Direction',
				name: 'direction',
				type: 'options',
				options: [
					{ name: 'All', value: 'all' },
					{ name: 'Received', value: 'received' },
					{ name: 'Sent', value: 'sent' },
				],
				default: 'all',
				description: 'Message direction filter (not the same as status)',
				routing: {
					send: {
						type: 'query',
						property: 'direction',
					},
				},
			},
			{
				displayName: 'From',
				name: 'from',
				type: 'dateTime',
				default: '',
				description:
					'Inclusive lower bound on createdAt (ISO 8601 with timezone, or a date like 2026-08-01)',
				routing: {
					send: {
						type: 'query',
						property: 'from',
						value: '={{ $value ? new Date($value).toISOString() : undefined }}',
					},
				},
			},
			{
				displayName: 'Order',
				name: 'order',
				type: 'options',
				options: [
					{ name: 'Ascending', value: 'asc' },
					{ name: 'Descending', value: 'desc' },
				],
				default: 'desc',
				description: 'Desc for newest first; asc to walk forward when polling',
				routing: {
					send: {
						type: 'query',
						property: 'order',
					},
				},
			},
			{
				displayName: 'Page',
				name: 'page',
				type: 'number',
				default: 1,
				description: 'Page to return (mutually exclusive with cursor)',
				routing: {
					send: {
						type: 'query',
						property: 'page',
					},
				},
			},
			{
				displayName: 'Search',
				name: 'search',
				type: 'string',
				default: '',
				description: 'Match against message text and the other party number',
				routing: {
					send: {
						type: 'query',
						property: 'search',
					},
				},
			},
			{
				displayName: 'SMS Batch ID',
				name: 'smsBatchId',
				type: 'string',
				default: '',
				description: 'Only messages from this send batch',
				routing: {
					send: {
						type: 'query',
						property: 'smsBatchId',
					},
				},
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				options: [
					{ name: 'Delivered', value: 'delivered' },
					{ name: 'Dispatched', value: 'dispatched' },
					{ name: 'Failed', value: 'failed' },
					{ name: 'Pending', value: 'pending' },
					{ name: 'Received', value: 'received' },
					{ name: 'Sent', value: 'sent' },
					{ name: 'Unknown', value: 'unknown' },
				],
				default: 'sent',
				description: 'Delivery state filter',
				routing: {
					send: {
						type: 'query',
						property: 'status',
					},
				},
			},
			{
				displayName: 'To',
				name: 'to',
				type: 'dateTime',
				default: '',
				description: 'Exclusive upper bound on createdAt',
				routing: {
					send: {
						type: 'query',
						property: 'to',
						value: '={{ $value ? new Date($value).toISOString() : undefined }}',
					},
				},
			},
		],
	},
];

export const messageGetManyRouting = {
	request: {
		method: 'GET' as const,
		url: '/gateway/messages',
	},
	output: {
		postReceive: unwrapDataPostReceive,
	},
};
