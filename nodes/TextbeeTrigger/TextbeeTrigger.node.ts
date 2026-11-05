import {
	NodeConnectionTypes,
	NodeOperationError,
	type IDataObject,
	type IHookFunctions,
	type INodeType,
	type INodeTypeDescription,
	type IWebhookFunctions,
	type IWebhookResponseData,
} from 'n8n-workflow';

import {
	generateSigningSecret,
	verifySignature,
	verifyTimestampedSignature,
} from '../Textbee/shared/signature';
import {
	isNotFoundError,
	planSubscription,
	resolveSigningSecret,
	subscriptionName,
	type DesiredSubscription,
	type WebhookSubscription,
} from '../Textbee/shared/subscription';
import { textbeeApiRequest, toNodeApiError } from '../Textbee/shared/transport';
import { isObjectId } from '../Textbee/shared/validation';

const EVENT_OPTIONS = [
	{
		name: 'Message Delivered',
		value: 'MESSAGE_DELIVERED',
		description: 'Carrier reports delivery to the recipient handset',
	},
	{
		name: 'Message Failed',
		value: 'MESSAGE_FAILED',
		description: 'Phone reports that an outgoing SMS failed',
	},
	{
		name: 'Message Received',
		value: 'MESSAGE_RECEIVED',
		description: 'Phone uploads an incoming SMS',
	},
	{
		name: 'Message Sent',
		value: 'MESSAGE_SENT',
		description: 'Phone reports that the carrier accepted an outgoing SMS',
	},
	{
		name: 'Unknown State',
		value: 'UNKNOWN_STATE',
		description: 'Phone reports a status that textbee cannot map',
	},
];

const MIN_SECRET_LENGTH = 20;

/** Build a webhook path from a stored or listed id, refusing anything that is not an ObjectId. */
function webhookPath(this: IHookFunctions, webhookId: string): string {
	if (!isObjectId(webhookId)) {
		throw new NodeOperationError(this.getNode(), 'Stored textbee webhook ID is not a valid ID');
	}
	return `/webhooks/${webhookId}`;
}

/**
 * The subscription this trigger should have. With an empty credential secret the
 * trigger uses its own stored secret. `generate` creates and stores one when it is
 * missing; without it, a missing secret returns undefined (an update is needed).
 */
async function desiredSubscription(
	this: IHookFunctions,
	generate: boolean,
): Promise<DesiredSubscription | undefined> {
	const credentials = await this.getCredentials('textbeeApi');
	const sharedSecret = String(credentials.webhookSigningSecret ?? '');
	if (sharedSecret !== '' && sharedSecret.length < MIN_SECRET_LENGTH) {
		throw new NodeOperationError(
			this.getNode(),
			`The Webhook Signing Secret on the textbee API credential must be at least ${MIN_SECRET_LENGTH} characters. Leave it empty to let the trigger create one.`,
		);
	}

	const webhookData = this.getWorkflowStaticData('node');
	let signingSecret = resolveSigningSecret(sharedSecret, webhookData.signingSecret);
	if (!signingSecret) {
		if (!generate) return undefined;
		signingSecret = generateSigningSecret();
		webhookData.signingSecret = signingSecret;
	}

	return {
		deliveryUrl: this.getNodeWebhookUrl('default') as string,
		events: this.getNodeParameter('events') as string[],
		signingSecret,
	};
}

/** Remember whether the API signs this subscription with X-Textbee-Signature. */
function storeSignatureVersion(
	webhookData: IDataObject,
	subscription: WebhookSubscription | undefined,
): void {
	if (Number(subscription?.signatureVersion ?? 0) >= 2) webhookData.signatureVersion = 2;
	else delete webhookData.signatureVersion;
}

/** Subscription name for this workflow and its delivery URL host. */
function nameFor(this: IHookFunctions, desired: DesiredSubscription): string {
	return subscriptionName(this.getWorkflow().name ?? 'workflow', desired.deliveryUrl);
}

/** PATCH a subscription to the desired state. Returns false when it no longer exists. */
async function updateSubscription(
	this: IHookFunctions,
	webhookId: string,
	desired: DesiredSubscription,
): Promise<boolean> {
	try {
		const response = (await textbeeApiRequest.call(
			this,
			'PATCH',
			webhookPath.call(this, webhookId),
			{
				name: nameFor.call(this, desired),
				deliveryUrl: desired.deliveryUrl,
				events: desired.events,
				signingSecret: desired.signingSecret,
				isActive: true,
			},
		)) as { data?: WebhookSubscription } | undefined;
		storeSignatureVersion(this.getWorkflowStaticData('node'), response?.data);
		return true;
	} catch (error) {
		if (isNotFoundError(error)) return false;
		throw toNodeApiError(this.getNode(), error);
	}
}

export class TextbeeTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'textbee Trigger',
		name: 'textbeeTrigger',
		icon: { light: 'file:../../icons/textbee.svg', dark: 'file:../../icons/textbee.dark.svg' },
		group: ['trigger'],
		version: [1],
		subtitle: '={{$parameter["events"].join(", ")}}',
		description: 'Starts the workflow when textbee sends an SMS webhook event',
		defaults: {
			name: 'textbee Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'textbeeApi',
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				options: EVENT_OPTIONS,
				default: ['MESSAGE_RECEIVED'],
				required: true,
				description: 'The textbee events that start this workflow',
			},
			{
				displayName:
					'Publishing this workflow creates the webhook in textbee for you. You do not need to add a webhook in the textbee dashboard. textbee only delivers to public URLs, so a localhost n8n needs a tunnel. For Message Received, turn on Receive SMS in the textbee Android app. If events stop arriving, publish the workflow again.',
				name: 'triggerNotice',
				type: 'notice',
				default: '',
			},
		],
	};

	webhookMethods = {
		default: {
			/** True when the stored subscription already matches the desired state. */
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				const webhookId = webhookData.webhookId as string | undefined;
				if (!webhookId) return false;

				let subscription: WebhookSubscription | undefined;
				try {
					const response = (await textbeeApiRequest.call(
						this,
						'GET',
						webhookPath.call(this, webhookId),
					)) as { data?: WebhookSubscription };
					subscription = response.data;
				} catch (error) {
					// Only a confirmed 404 means the subscription is gone. Anything
					// else is rethrown so a transient error never creates a duplicate.
					if (!isNotFoundError(error)) throw toNodeApiError(this.getNode(), error);
				}

				if (!subscription) {
					delete webhookData.webhookId;
					return false;
				}
				storeSignatureVersion(webhookData, subscription);

				// On a mismatch keep the id: create() patches this subscription in place.
				const desired = await desiredSubscription.call(this, false);
				return desired !== undefined && planSubscription(subscription, desired) === 'keep';
			},

			/** Patch the stored or a same-URL subscription, else create a new one. */
			async create(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				const desired = (await desiredSubscription.call(this, true)) as DesiredSubscription;

				const storedId = webhookData.webhookId as string | undefined;
				if (storedId && (await updateSubscription.call(this, storedId, desired))) {
					return true;
				}
				delete webhookData.webhookId;

				// Reuse a subscription that already points at this URL, for example
				// after the workflow static data was lost.
				const list = (await textbeeApiRequest.call(this, 'GET', '/webhooks')) as {
					data?: WebhookSubscription[];
				};
				const existing = (list.data ?? []).find(
					(subscription) => subscription.deliveryUrl === desired.deliveryUrl,
				);
				if (existing && (await updateSubscription.call(this, existing._id, desired))) {
					webhookData.webhookId = existing._id;
					return true;
				}

				const response = (await textbeeApiRequest.call(this, 'POST', '/webhooks', {
					name: nameFor.call(this, desired),
					deliveryUrl: desired.deliveryUrl,
					signingSecret: desired.signingSecret,
					events: desired.events,
				})) as { data: WebhookSubscription };

				webhookData.webhookId = response.data._id;
				storeSignatureVersion(webhookData, response.data);
				return true;
			},

			/** Delete the subscription and forget its id, secret and signature version. */
			async delete(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				const webhookId = webhookData.webhookId as string | undefined;
				if (!webhookId) return true;

				try {
					await textbeeApiRequest.call(this, 'DELETE', webhookPath.call(this, webhookId));
				} catch (error) {
					// Already gone is fine. Surface everything else unchanged.
					if (!isNotFoundError(error)) throw toNodeApiError(this.getNode(), error);
				}

				delete webhookData.webhookId;
				delete webhookData.signingSecret;
				delete webhookData.signatureVersion;
				return true;
			},
		},
	};

	/** Verify the signature and subscription, then start a run for a selected event. */
	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const credentials = await this.getCredentials('textbeeApi');
		const webhookData = this.getWorkflowStaticData('node');
		// Neither secret set means verification fails and the request gets a 401.
		const signingSecret = resolveSigningSecret(
			credentials.webhookSigningSecret,
			webhookData.signingSecret,
		);
		const headerData = this.getHeaderData();
		const legacyHeader = headerData['x-signature'] as string | undefined;
		const timestampedHeader = headerData['x-textbee-signature'] as string | undefined;

		const rawBody = this.getRequestObject().rawBody;
		const bodyBuffer = Buffer.isBuffer(rawBody)
			? rawBody
			: Buffer.from(typeof rawBody === 'string' ? rawBody : JSON.stringify(this.getBodyData()));

		// Once the API reported signature version 2, X-Textbee-Signature is required.
		// Accepting X-Signature alone would let an attacker strip the timestamped
		// header and replay an old delivery. Older APIs only send X-Signature.
		const requireTimestamped = Number(webhookData.signatureVersion ?? 0) >= 2;
		const valid =
			requireTimestamped || timestampedHeader !== undefined
				? verifyTimestampedSignature(
						bodyBuffer,
						timestampedHeader,
						signingSecret,
						Math.floor(Date.now() / 1000),
					)
				: verifySignature(bodyBuffer, legacyHeader, signingSecret);

		if (!valid) {
			this.getResponseObject().status(401).json({ error: 'Invalid signature' });
			return { noWebhookResponse: true };
		}

		const bodyData = this.getBodyData() as IDataObject;

		// A credential secret is shared by every trigger on the credential, so also
		// check that the delivery belongs to this trigger's subscription.
		const ownId = webhookData.webhookId as string | undefined;
		const deliveredFor = bodyData.webhookSubscriptionId as string | undefined;
		if (ownId && deliveredFor && String(deliveredFor) !== String(ownId)) {
			this.getResponseObject().status(401).json({ error: 'Unknown subscription' });
			return { noWebhookResponse: true };
		}

		const events = this.getNodeParameter('events') as string[];
		const eventName = bodyData.webhookEvent as string | undefined;
		if (!eventName || !events.includes(eventName)) {
			// No workflowData: n8n acknowledges the call without starting a run.
			return {};
		}

		return {
			workflowData: [this.helpers.returnJsonArray([bodyData])],
		};
	}
}
