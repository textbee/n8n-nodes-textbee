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

import { verifySignature } from '../Textbee/shared/signature';
import {
	isNotFoundError,
	planSubscription,
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

async function desiredSubscription(this: IHookFunctions): Promise<DesiredSubscription> {
	const credentials = await this.getCredentials('textbeeApi');
	const signingSecret = String(credentials.webhookSigningSecret ?? '');
	if (signingSecret.length < MIN_SECRET_LENGTH) {
		throw new NodeOperationError(
			this.getNode(),
			`Set a Webhook Signing Secret of at least ${MIN_SECRET_LENGTH} characters on the textbee API credential`,
		);
	}
	return {
		deliveryUrl: this.getNodeWebhookUrl('default') as string,
		events: this.getNodeParameter('events') as string[],
		signingSecret,
	};
}

function subscriptionName(this: IHookFunctions): string {
	return `n8n: ${this.getWorkflow().name ?? 'workflow'}`.slice(0, 64);
}

/** PATCH a subscription to the desired state. Returns false when it no longer exists. */
async function updateSubscription(
	this: IHookFunctions,
	webhookId: string,
	desired: DesiredSubscription,
): Promise<boolean> {
	try {
		await textbeeApiRequest.call(this, 'PATCH', webhookPath.call(this, webhookId), {
			name: subscriptionName.call(this),
			deliveryUrl: desired.deliveryUrl,
			events: desired.events,
			signingSecret: desired.signingSecret,
			isActive: true,
		});
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
					'Set a Webhook Signing Secret (at least 20 characters) on the textbee API credential. textbee only delivers to public URLs, so the n8n test URL on localhost does not work: use a tunnel in development. For Message Received, turn on Receive SMS in the textbee Android app.',
				name: 'triggerNotice',
				type: 'notice',
				default: '',
			},
		],
	};

	webhookMethods = {
		default: {
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

				// On a mismatch keep the id: create() patches this subscription in place.
				const desired = await desiredSubscription.call(this);
				return planSubscription(subscription, desired) === 'keep';
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				const desired = await desiredSubscription.call(this);

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
					name: subscriptionName.call(this),
					deliveryUrl: desired.deliveryUrl,
					signingSecret: desired.signingSecret,
					events: desired.events,
				})) as { data: WebhookSubscription };

				webhookData.webhookId = response.data._id;
				return true;
			},

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
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const credentials = await this.getCredentials('textbeeApi');
		const signingSecret = credentials.webhookSigningSecret as string | undefined;
		const headerData = this.getHeaderData();
		const signatureHeader = headerData['x-signature'] as string | undefined;

		const rawBody = this.getRequestObject().rawBody;
		const bodyBuffer = Buffer.isBuffer(rawBody)
			? rawBody
			: Buffer.from(typeof rawBody === 'string' ? rawBody : JSON.stringify(this.getBodyData()));

		if (!verifySignature(bodyBuffer, signatureHeader, signingSecret)) {
			this.getResponseObject().status(401).json({ error: 'Invalid signature' });
			return { noWebhookResponse: true };
		}

		const bodyData = this.getBodyData() as IDataObject;

		// The signing secret is shared by every trigger on the credential, so also
		// check that the delivery belongs to this trigger's subscription.
		const ownId = this.getWorkflowStaticData('node').webhookId as string | undefined;
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
