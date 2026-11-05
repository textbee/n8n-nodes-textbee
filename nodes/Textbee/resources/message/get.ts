import type { INodeProperties } from 'n8n-workflow';

import { requireObjectIds } from '../../shared/validation';
import { deviceIdProperty, unwrapDataPostReceive } from '../../shared/descriptions';

const showOnlyForMessageGet = {
	operation: ['get'],
	resource: ['message'],
};

export const messageGetDescription: INodeProperties[] = [
	{
		...deviceIdProperty,
		required: true,
		displayOptions: {
			show: showOnlyForMessageGet,
		},
	},
	{
		displayName: 'Message ID',
		name: 'smsId',
		type: 'string',
		default: '',
		required: true,
		description: 'Message ID from the message history response',
		displayOptions: {
			show: showOnlyForMessageGet,
		},
	},
];

export const messageGetRouting = {
	send: {
		preSend: [requireObjectIds('deviceId', 'smsId')],
	},
	request: {
		method: 'GET' as const,
		url: '=/gateway/devices/{{$parameter.deviceId.value}}/sms/{{$parameter.smsId}}',
	},
	output: {
		postReceive: unwrapDataPostReceive,
	},
};
