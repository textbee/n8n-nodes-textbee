import type { INodeProperties } from 'n8n-workflow';

import { unwrapDataPostReceive } from '../../shared/descriptions';

const showOnlyForDeviceGetMany = {
	operation: ['getAll'],
	resource: ['device'],
};

export const deviceGetManyDescription: INodeProperties[] = [
	{
		displayName: 'Returns every phone paired with your textbee account.',
		name: 'deviceListNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: showOnlyForDeviceGetMany,
		},
	},
];

export const deviceGetManyRouting = {
	request: {
		method: 'GET' as const,
		url: '/gateway/devices',
	},
	output: {
		postReceive: unwrapDataPostReceive,
	},
};
