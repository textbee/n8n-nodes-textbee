import {
	NodeApiError,
	type IDataObject,
	type IExecuteFunctions,
	type IHookFunctions,
	type IHttpRequestMethods,
	type IHttpRequestOptions,
	type INode,
	type ILoadOptionsFunctions,
	type IWebhookFunctions,
	type JsonObject,
} from 'n8n-workflow';

import { normalizeBaseUrl } from './baseUrl';

type TextbeeContext =
	IHookFunctions | IExecuteFunctions | ILoadOptionsFunctions | IWebhookFunctions;

export async function textbeeApiRequest(
	this: TextbeeContext,
	method: IHttpRequestMethods,
	resource: string,
	body: IDataObject | undefined = undefined,
	qs: IDataObject = {},
) {
	const credentials = await this.getCredentials('textbeeApi');
	const baseURL = normalizeBaseUrl(String(credentials.baseUrl ?? ''));

	const options: IHttpRequestOptions = {
		method,
		qs,
		body,
		baseURL,
		url: resource,
		json: true,
	};

	try {
		return await this.helpers.httpRequestWithAuthentication.call(this, 'textbeeApi', options);
	} catch (error) {
		throw toNodeApiError(this.getNode(), error);
	}
}

/** Return the error as a NodeApiError without wrapping one that already is. */
export function toNodeApiError(node: INode, error: unknown): NodeApiError {
	return error instanceof NodeApiError ? error : new NodeApiError(node, error as JsonObject);
}
