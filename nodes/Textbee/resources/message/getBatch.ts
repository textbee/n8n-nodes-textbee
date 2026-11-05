import type { INodeProperties } from 'n8n-workflow';

import { requireObjectIds } from '../../shared/validation';
import { deviceIdProperty, unwrapDataPostReceive } from '../../shared/descriptions';

const showOnlyForMessageGetBatch = {
	operation: ['getBatch'],
	resource: ['message'],
};

export const messageGetBatchDescription: INodeProperties[] = [
	{
		...deviceIdProperty,
		required: true,
		displayOptions: {
			show: showOnlyForMessageGetBatch,
		},
	},
	{
		displayName: 'SMS Batch ID',
		name: 'smsBatchId',
		type: 'string',
		default: '',
		required: true,
		description: 'Batch ID returned as smsBatchId by the send endpoints',
		displayOptions: {
			show: showOnlyForMessageGetBatch,
		},
	},
];

export const messageGetBatchRouting = {
	send: {
		preSend: [requireObjectIds('deviceId', 'smsBatchId')],
	},
	request: {
		method: 'GET' as const,
		url: '=/gateway/devices/{{$parameter.deviceId.value}}/sms-batch/{{$parameter.smsBatchId}}',
	},
	output: {
		postReceive: unwrapDataPostReceive,
	},
};
