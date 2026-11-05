import type { IDataObject, IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';

export type BulkMessageInput = {
	message?: string;
	recipients?: string;
	simSubscriptionId?: number;
	scheduledAt?: string;
};

export type BulkMessage = {
	message: string;
	recipients: string[];
	simSubscriptionId?: number;
	scheduledAt?: string;
};

export function splitRecipients(value: unknown): string[] {
	return String(value ?? '')
		.split(/[,\n]/)
		.map((recipient) => recipient.trim())
		.filter(Boolean);
}

/** Map the Messages fixedCollection to the send-bulk-sms `messages` array. */
export function buildBulkMessages(entries: BulkMessageInput[]): BulkMessage[] {
	return entries.map((entry) => {
		const message: BulkMessage = {
			message: entry.message ?? '',
			recipients: splitRecipients(entry.recipients),
		};
		// 0 is the field default and means "use the device default SIM".
		if (entry.simSubscriptionId) message.simSubscriptionId = entry.simSubscriptionId;
		if (entry.scheduledAt) message.scheduledAt = new Date(entry.scheduledAt).toISOString();
		return message;
	});
}

export async function bulkMessagesPreSend(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const collection = this.getNodeParameter('messages', {}) as {
		messageValues?: BulkMessageInput[];
	};
	const body = (requestOptions.body ?? {}) as IDataObject;
	body.messages = buildBulkMessages(collection.messageValues ?? []);
	requestOptions.body = body;
	return requestOptions;
}
