import { readFileSync } from 'fs';
import { join } from 'path';
import type { INodeProperties } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';

import { Textbee } from '../nodes/Textbee/Textbee.node';
import { TextbeeTrigger } from '../nodes/TextbeeTrigger/TextbeeTrigger.node';

const root = join(__dirname, '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { name: string };

function codex(path: string): { node: string } {
	return JSON.parse(readFileSync(join(root, path), 'utf8'));
}

type RoutedOption = {
	name: string;
	action?: string;
	routing?: { request?: { url?: string }; send?: { preSend?: unknown[] } };
};

const node = new Textbee();
const operations = node.description.properties
	.filter((p: INodeProperties) => p.name === 'operation')
	.flatMap((p) => (p.options ?? []) as RoutedOption[]);

describe('node descriptions', () => {
	it('codex node ids match the package name and node names', () => {
		expect(codex('nodes/Textbee/Textbee.node.json').node).toBe(
			`${pkg.name}.${node.description.name}`,
		);
		expect(codex('nodes/TextbeeTrigger/TextbeeTrigger.node.json').node).toBe(
			`${pkg.name}.${new TextbeeTrigger().description.name}`,
		);
	});

	it('every operation has an action and an API route', () => {
		expect(operations.length).toBeGreaterThan(10);
		for (const operation of operations) {
			expect(operation.action, operation.name).toBeTruthy();
			expect(operation.routing?.request?.url, operation.name).toMatch(
				/^=?\/(gateway|webhooks)(\/|$)/,
			);
		}
	});

	it('every route that interpolates a parameter validates it first', () => {
		for (const operation of operations) {
			const url = operation.routing?.request?.url ?? '';
			if (url.includes('$parameter')) {
				expect(operation.routing?.send?.preSend?.length, url).toBeGreaterThan(0);
			}
		}
	});
});
