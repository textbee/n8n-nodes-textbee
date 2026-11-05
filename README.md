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

| Field                      | Required | Description                                                                                                                                                                                    |
| -------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **API Key**                | Yes      | From the [textbee dashboard](https://app.textbee.dev/dashboard). See [API keys](https://textbee.dev/docs/getting-started/api-keys).                                                            |
| **Base URL**               | No       | Defaults to `https://api.textbee.dev`. Change it for [self-hosted](https://textbee.dev/docs/self-hosting) instances. The `/api/v1` suffix is added automatically.                              |
| **Webhook Signing Secret** | No       | Leave it empty: the textbee Trigger creates a separate secret for each workflow. Set it (at least 20 characters) only if you need the same secret across workflows. If set, it is always used. |

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

No setup in the textbee dashboard is needed. When you publish the workflow, the trigger creates a webhook subscription in textbee that points at the n8n production webhook URL. When you unpublish it, the trigger deletes the subscription. If the URL, the events, or the signing secret change, the trigger updates the existing subscription instead of creating a new one. If events stop arriving, publish the workflow again.

The subscription is named `n8n: <workflow name> (<n8n host>)`, so you can see in the textbee dashboard which n8n instance owns it.

A textbee account can have 5 webhook subscriptions by default. The limit depends on your plan. Each published workflow with a textbee Trigger uses one.

#### Signing secret

When the credential **Webhook Signing Secret** is empty, the trigger creates a random secret for each workflow and keeps it in the workflow's static data in n8n. Each workflow then has its own secret, and the secret never appears in node output. When the credential secret is set, every trigger on that credential uses it, and the trigger also checks that each delivery belongs to its own subscription.

#### Signature checks and replay protection

textbee signs every delivery. Requests with a missing or wrong signature get HTTP 401.

- `X-Textbee-Signature: t=<unix seconds>,v1=<hex>`: `v1` is the HMAC-SHA256 of `<t>.<raw body>`. The trigger rejects a timestamp more than 5 minutes away from the current time, so a captured request cannot be replayed later. `X-Textbee-Timestamp` carries the same timestamp.
- `X-Signature`: the HMAC-SHA256 of the raw body, without a timestamp. textbee still sends it for older integrations.

When the textbee API reports timestamped signatures for the subscription, the trigger requires a valid `X-Textbee-Signature` and rejects requests that only carry `X-Signature`. Older and self-hosted textbee versions that do not send the timestamped header are still accepted with `X-Signature`.

Notes:

- After you upgrade this package, publish your textbee Trigger workflows again (or restart n8n). The trigger learns that the API supports timestamped signatures when the workflow is published.
- The n8n server clock must be correct (use NTP). A clock that is more than 5 minutes off makes every delivery fail.
- If you change the credential signing secret, publish the workflows again so textbee uses the new secret.

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
4. Publish the workflow. The production webhook URL must be public, because textbee does not deliver to localhost or private addresses. In development, use a tunnel.

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
