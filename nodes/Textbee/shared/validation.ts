import {
	NodeOperationError,
	type IDataObject,
	type IExecuteSingleFunctions,
	type IHttpRequestOptions,
	type INodeExecutionData,
} from 'n8n-workflow';

const OBJECT_ID = /^[a-f0-9]{24}$/i;

export function isObjectId(value: unknown): boolean {
	return typeof value === 'string' && OBJECT_ID.test(value);
}

function parameterValue(raw: unknown): string {
	if (raw && typeof raw === 'object' && 'value' in raw) {
		return String((raw as { value?: unknown }).value ?? '');
	}
	return String(raw ?? '');
}

/**
 * preSend hook that rejects any ID parameter that is not a 24-hex ObjectId.
 * IDs are interpolated into request paths, so a value like `../auth/api-keys/x`
 * would otherwise reach a different API route with the user's key.
 * Optional parameters are checked only when set.
 */
export function requireObjectIds(...names: string[]) {
	return async function (
		this: IExecuteSingleFunctions,
		requestOptions: IHttpRequestOptions,
	): Promise<IHttpRequestOptions> {
		for (const name of names) {
			const optional = name.endsWith('?');
			const parameter = optional ? name.slice(0, -1) : name;
			const value = parameterValue(this.getNodeParameter(parameter, ''));
			if (optional && value === '') continue;
			if (!isObjectId(value)) {
				throw new NodeOperationError(
					this.getNode(),
					`"${parameter}" must be a 24-character textbee ID`,
				);
			}
		}
		return requestOptions;
	};
}

/**
 * Remove webhook signing secrets and device push tokens from output, so they
 * never land in n8n execution data or in front of an AI agent.
 */
export function stripSecrets(items: INodeExecutionData[]): INodeExecutionData[] {
	for (const item of items) {
		const json = item.json as IDataObject;
		delete json.signingSecret;
		const subscription = json.webhookSubscriptionData as IDataObject | undefined;
		if (subscription && typeof subscription === 'object') delete subscription.signingSecret;
		const device = json.deviceData as IDataObject | undefined;
		if (device && typeof device === 'object') delete device.fcmToken;
	}
	return items;
}

export async function stripSecretsPostReceive(
	this: IExecuteSingleFunctions,
	items: INodeExecutionData[],
): Promise<INodeExecutionData[]> {
	return stripSecrets(items);
}
