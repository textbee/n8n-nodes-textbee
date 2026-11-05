// Repo hygiene gate, run in CI. Fails on:
// - em or en dashes in source or docs (house rule)
// - the camel-cased brand spelling; the brand is lowercase textbee, PascalCase identifiers use Textbee
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const failures = [];

function walk(dir) {
	const out = [];
	for (const name of readdirSync(dir)) {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) out.push(...walk(path));
		else if (/\.(ts|mts|json|md|mjs)$/.test(name)) out.push(path);
	}
	return out;
}

const files = [
	...walk('nodes'),
	...walk('credentials'),
	...walk('test'),
	...walk('scripts'),
	'README.md',
	'NOTICE.md',
	'CHANGELOG.md',
	'package.json',
];

for (const file of files) {
	readFileSync(file, 'utf8')
		.split('\n')
		.forEach((line, i) => {
			if (line.includes('\u2014') || line.includes('\u2013')) {
				failures.push(
					`${file}:${i + 1}: em or en dash found; use a period, comma, colon, or hyphen`,
				);
			}
			if (/Text\u0042ee/.test(line)) {
				failures.push(
					`${file}:${i + 1}: write "textbee" (or Textbee in identifiers), not Text\u0042ee`,
				);
			}
		});
}

if (failures.length > 0) {
	console.error('hygiene check failed:');
	for (const failure of failures) console.error(`  ${failure}`);
	process.exit(1);
}
console.error(`hygiene check passed (${files.length} files).`);
