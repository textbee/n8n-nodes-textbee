import type {
	ILoadOptionsFunctions,
	INodeListSearchItems,
	INodeListSearchResult,
} from 'n8n-workflow';

import { textbeeApiRequest } from '../shared/transport';

type DeviceDto = {
	_id: string;
	name?: string;
	brand?: string;
	model?: string;
	enabled?: boolean;
	isDefault?: boolean;
};

type DevicesResponse = {
	data: DeviceDto[];
};

export async function searchDevices(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const response = (await textbeeApiRequest.call(
		this,
		'GET',
		'/gateway/devices',
	)) as DevicesResponse;
	const devices = response.data ?? [];

	const needle = (filter ?? '').toLowerCase();

	const results: INodeListSearchItems[] = devices
		.filter((device) => {
			if (!needle) return true;
			const label = [device.name, device.brand, device.model, device._id]
				.filter(Boolean)
				.join(' ')
				.toLowerCase();
			return label.includes(needle);
		})
		.map((device) => {
			const parts = [
				device.name || `${device.brand ?? ''} ${device.model ?? ''}`.trim() || device._id,
			];
			if (device.isDefault) parts.push('(default)');
			if (device.enabled === false) parts.push('(disabled)');
			return {
				name: parts.join(' '),
				value: device._id,
			};
		});

	return { results };
}
