import type { INodeProperties } from 'n8n-workflow';

import { statsGetDescription, statsGetRouting } from './get';

const showOnlyForStats = {
	resource: ['account'],
};

export const statsDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForStats,
		},
		options: [
			{
				name: 'Get',
				value: 'get',
				action: 'Get account stats',
				description: 'Get account totals for sent/received SMS, devices, and API keys',
				routing: statsGetRouting,
			},
		],
		default: 'get',
	},
	...statsGetDescription,
];
