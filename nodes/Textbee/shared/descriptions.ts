import type { INodeProperties } from 'n8n-workflow';

export const deviceIdProperty: INodeProperties = {
	displayName: 'Device',
	name: 'deviceId',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	description:
		'Device to use. When omitted on send, textbee uses the default device or the enabled device with the most recent heartbeat.',
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			placeholder: 'Select a device…',
			typeOptions: {
				searchListMethod: 'searchDevices',
				searchable: true,
			},
		},
		{
			displayName: 'ID',
			name: 'id',
			type: 'string',
			placeholder: '664a9b8cd0e1f2a3b4c5d6e7',
			validation: [
				{
					type: 'regex',
					properties: {
						regex: '^[a-fA-F0-9]{24}$',
						errorMessage: 'Not a valid textbee device ID',
					},
				},
			],
		},
	],
};

export const unwrapDataPostReceive = [
	{
		type: 'rootProperty' as const,
		properties: {
			property: 'data',
		},
	},
];

/**
 * Body of the routing expression for the SIM dropdown. Empty means Default and
 * omits the field. A whole number is sent as a number (0 is SIM 1). Anything
 * else is sent unchanged so the API answers with a 400 instead of silently
 * using the default SIM.
 */
export const simSlotExpressionBody =
	"$value === '' || $value === undefined || $value === null ? undefined : (Number.isInteger(typeof $value === 'string' && $value.trim() === '' ? NaN : Number($value)) ? Number($value) : $value)";
