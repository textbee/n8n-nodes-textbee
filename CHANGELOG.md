# Changelog

## 1.0.0 (2026-11-05)

First release as the official `@textbee/n8n-nodes-textbee` package. The nodes were first built by [Julius Haring](https://github.com/JuliusHaring) and published as `@aixrun/n8n-nodes-textbee`, which is no longer available.

- textbee node: send SMS, send bulk SMS, read messages and send batches, list devices, account stats, manage webhook subscriptions.
- textbee Trigger node: start workflows on received, sent, delivered and failed SMS. The trigger updates its webhook subscription in place, so it does not leave unused subscriptions behind.
- IDs used in request paths are validated before the request is sent.
- Webhook signing secrets and device push tokens are removed from node output.
