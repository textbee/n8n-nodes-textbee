import {
	NodeOperationError,
	type IDataObject,
	type IExecuteSingleFunctions,
	type IHttpRequestOptions,
} from 'n8n-workflow';

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

export class InvalidScheduleError extends Error {
	constructor(
		readonly entry: number,
		value: string,
	) {
		super(`Message ${entry}: "${value}" is not a valid Scheduled At date`);
	}
}

/** Map the Messages fixedCollection to the send-bulk-sms `messages` array. */
export function buildBulkMessages(entries: BulkMessageInput[]): BulkMessage[] {
	return entries.map((entry, index) => {
		const message: BulkMessage = {
			message: entry.message ?? '',
			recipients: splitRecipients(entry.recipients),
		};
		// 0 is the field default and means "use the device default SIM".
		if (entry.simSubscriptionId) message.simSubscriptionId = entry.simSubscriptionId;
		if (entry.scheduledAt) {
			const date = new Date(entry.scheduledAt);
			if (Number.isNaN(date.getTime())) {
				throw new InvalidScheduleError(index + 1, entry.scheduledAt);
			}
			message.scheduledAt = date.toISOString();
		}
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
	try {
		body.messages = buildBulkMessages(collection.messageValues ?? []);
	} catch (error) {
		if (error instanceof InvalidScheduleError) {
			throw new NodeOperationError(this.getNode(), error.message);
		}
		throw new NodeOperationError(this.getNode(), String(error));
	}
	requestOptions.body = body;
	return requestOptions;
}
