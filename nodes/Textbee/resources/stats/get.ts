import type { INodeProperties } from 'n8n-workflow';

import { unwrapDataPostReceive } from '../../shared/descriptions';

const showOnlyForStatsGet = {
	operation: ['get'],
	resource: ['account'],
};

export const statsGetDescription: INodeProperties[] = [
	{
		displayName: 'This returns account totals: sent SMS, received SMS, devices, and API keys.',
		name: 'statsNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: showOnlyForStatsGet,
		},
	},
];

export const statsGetRouting = {
	request: {
		method: 'GET' as const,
		url: '/gateway/stats',
	},
	output: {
		postReceive: unwrapDataPostReceive,
	},
};
