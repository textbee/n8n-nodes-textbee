import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

import { baseUrlExpression } from '../nodes/Textbee/shared/baseUrl';

export class TextbeeApi implements ICredentialType {
	name = 'textbeeApi';

	displayName = 'Textbee API';

	icon: Icon = { light: 'file:../icons/textbee.svg', dark: 'file:../icons/textbee.dark.svg' };

	documentationUrl = 'https://textbee.dev/docs/getting-started/api-keys';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'API key from the textbee dashboard',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.textbee.dev',
			placeholder: 'https://api.textbee.dev',
			description:
				'textbee API host. Defaults to the hosted service. Change for self-hosted instances. The `/api/v1` suffix is optional and added automatically.',
		},
		{
			displayName: 'Webhook Signing Secret',
			name: 'webhookSigningSecret',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description:
				'Optional. Leave empty and the textbee Trigger creates a separate secret for each workflow. Set it only if you need the same secret across workflows.',
			hint: 'If set, use at least 20 characters',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'x-api-key': '={{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: baseUrlExpression,
			url: '/gateway/stats',
			method: 'GET',
		},
	};
}
