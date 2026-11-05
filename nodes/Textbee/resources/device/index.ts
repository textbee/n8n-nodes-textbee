import type { INodeProperties } from 'n8n-workflow';

import { deviceGetDescription, deviceGetRouting } from './get';
import { deviceGetManyDescription, deviceGetManyRouting } from './getAll';

const showOnlyForDevice = {
	resource: ['device'],
};

export const deviceDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForDevice,
		},
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many devices',
				description: 'List every phone paired with your account',
				routing: deviceGetManyRouting,
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a device',
				description: 'Get full state of one device including heartbeat and SIM list',
				routing: deviceGetRouting,
			},
		],
		default: 'getAll',
	},
	...deviceGetManyDescription,
	...deviceGetDescription,
];
