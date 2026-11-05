import type { INodeProperties } from 'n8n-workflow';

import { requireObjectIds } from '../../shared/validation';
import { deviceIdProperty, unwrapDataPostReceive } from '../../shared/descriptions';

const showOnlyForDeviceGet = {
	operation: ['get'],
	resource: ['device'],
};

export const deviceGetDescription: INodeProperties[] = [
	{
		...deviceIdProperty,
		required: true,
		displayOptions: {
			show: showOnlyForDeviceGet,
		},
	},
];

export const deviceGetRouting = {
	send: {
		preSend: [requireObjectIds('deviceId')],
	},
	request: {
		method: 'GET' as const,
		url: '=/gateway/devices/{{$parameter.deviceId.value}}',
	},
	output: {
		postReceive: unwrapDataPostReceive,
	},
};
