# Changelog

## 1.1.0 (2026-11-05)

- The Webhook Signing Secret on the credential is now optional. When it is empty, the textbee Trigger creates a separate random secret for each workflow and stores it with the workflow. A secret set on the credential still works as before.
- The trigger verifies the new timestamped `X-Textbee-Signature` header and rejects deliveries older than 5 minutes. When the textbee API reports timestamped signatures, deliveries with only the legacy `X-Signature` are rejected. Older textbee versions keep working with `X-Signature`.
- Webhook subscriptions are named `n8n: <workflow name> (<n8n host>)`, within the 64 character limit.
- The trigger notice explains that publishing creates the webhook in textbee, so no dashboard setup is needed.

## 1.0.0 (2026-11-05)

First release as the official `@textbee/n8n-nodes-textbee` package. The nodes were first built by [Julius Haring](https://github.com/JuliusHaring) and published as `@aixrun/n8n-nodes-textbee`, which is no longer available.

- textbee node: send SMS, send bulk SMS, read messages and send batches, list devices, account stats, manage webhook subscriptions.
- textbee Trigger node: start workflows on received, sent, delivered and failed SMS. The trigger updates its webhook subscription in place, so it does not leave unused subscriptions behind.
- IDs used in request paths are validated before the request is sent.
- Webhook signing secrets and device push tokens are removed from node output.
