# @textbee/n8n-nodes-textbee

[![npm](https://img.shields.io/npm/v/@textbee/n8n-nodes-textbee.svg)](https://www.npmjs.com/package/@textbee/n8n-nodes-textbee)
[![CI](https://github.com/textbee/n8n-nodes-textbee/actions/workflows/ci.yml/badge.svg)](https://github.com/textbee/n8n-nodes-textbee/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE.md)

Official [n8n](https://n8n.io) nodes for [textbee.dev](https://textbee.dev), the open-source SMS gateway. Send and receive SMS in your workflows through your own Android phone.

- **textbee** node: send SMS (one message or bulk), read message history, list devices, manage webhook subscriptions.
- **textbee Trigger** node: start a workflow when your phone receives an SMS, or when a sent SMS is sent, delivered, or fails.

The textbee node can also be used as a tool by the n8n AI Agent.

## Installation

### Self-hosted n8n

1. Go to **Settings > Community Nodes**.
2. Select **Install**.
3. Enter `@textbee/n8n-nodes-textbee`.
4. Agree to the risks and install.

Or install it from the environment when n8n starts. The value is a JSON array:

```bash
N8N_COMMUNITY_PACKAGES='[{"name":"@textbee/n8n-nodes-textbee"}]'
```

Restart n8n after you set it. See [installing with environment variables](https://docs.n8n.io/integrations/community-nodes/installation-and-management/environment-variable-installation/) in the n8n docs.

### n8n Cloud

The nodes are in review for n8n verification. After approval you can add them from the nodes panel in n8n Cloud.

## Credentials

Create a **Textbee API** credential:

| Field                      | Required     | Description                                                                                                                                                       |
| -------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **API Key**                | Yes          | From the [textbee dashboard](https://app.textbee.dev/dashboard). See [API keys](https://textbee.dev/docs/getting-started/api-keys).                               |
| **Base URL**               | No           | Defaults to `https://api.textbee.dev`. Change it for [self-hosted](https://textbee.dev/docs/self-hosting) instances. The `/api/v1` suffix is added automatically. |
| **Webhook Signing Secret** | Trigger only | At least 20 characters. textbee signs every webhook delivery with it, and the trigger rejects requests without a valid signature.                                 |

## Operations

### textbee

| Resource             | Operations                                                |
| -------------------- | --------------------------------------------------------- |
| Message              | Send, Send Bulk, Get Many, Get, Get Batch                 |
| Device               | Get Many, Get                                             |
| Account              | Get (totals for sent and received SMS, devices, API keys) |
| Webhook Subscription | Create, Get, Get Many, Update, Delete, Get Notifications  |

### textbee Trigger

Starts a workflow on these events: `MESSAGE_RECEIVED`, `MESSAGE_SENT`, `MESSAGE_DELIVERED`, `MESSAGE_FAILED`, `UNKNOWN_STATE`.

When you activate the workflow, the trigger registers a webhook subscription in textbee that points at the n8n production webhook URL. When you deactivate it, the trigger deletes the subscription. If the URL, the events, or the signing secret change, the trigger updates the existing subscription instead of creating a new one.

Every request is checked against the `X-Signature` header (HMAC-SHA256 of the raw body). Requests with a missing or wrong signature get HTTP 401.

## Usage

### Send an SMS

1. Add a **textbee** node.
2. Set Resource to **Message** and Operation to **Send**.
3. Enter the **Message** and the **Recipients** (phone numbers or short codes, comma-separated). International format, for example `+15555550123`, reaches any country. Local numbers and short codes reach recipients in the sending phone's country.
4. Optionally pick a **Device**. Without one, textbee uses your default device.

A successful response means textbee accepted and queued the message. It is not a delivery confirmation. To follow the status, use **Get Many** with the `smsBatchId` filter, or a **textbee Trigger** on **Message Delivered** and **Message Failed**.

### Reply to incoming SMS

1. In the textbee Android app, turn on **Receive SMS**.
2. Add a **textbee Trigger** and select **Message Received**.
3. Connect a **textbee** node with Operation **Send**. Set Recipients to `{{ $json.sender }}` and write the reply in Message.
4. Activate the workflow. The production webhook URL must be public, because textbee does not deliver to localhost or private addresses. In development, use a tunnel.

textbee retries failed deliveries. Use the `idempotencyKey` field of the payload to skip duplicates.

## Resources

- [n8n guide for textbee](https://textbee.dev/docs/agents/n8n)
- [textbee API reference](https://textbee.dev/docs/api-reference)
- [Webhooks](https://textbee.dev/docs/webhooks)
- [Self-hosting textbee](https://textbee.dev/docs/self-hosting)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)

## Development

This project uses pnpm.

```bash
pnpm install
pnpm dev        # starts n8n on http://localhost:5678 with these nodes loaded
pnpm test       # unit tests
pnpm lint       # n8n community node linter
pnpm build
```

Releases are driven by the `version` field in `package.json`. Bump it in a pull request. When the pull request is merged to `main`, the [publish workflow](.github/workflows/publish.yml) publishes the package to npm with a provenance attestation, then tags the commit and creates the GitHub release.

## Credits

[Julius Haring](https://github.com/JuliusHaring) ([aixRun](https://www.aixrun.de)) built the first version of these nodes and handed the project over to textbee. Thank you, Julius.

## License

[MIT](./LICENSE.md). Third-party notices are in [NOTICE.md](./NOTICE.md).
