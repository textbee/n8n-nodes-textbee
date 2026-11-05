/**
 * Normalize a textbee instance URL so it ends with `/api/v1`.
 * Matches SDK/MCP behavior: `/api/v1` is optional and added when missing.
 */
export function normalizeBaseUrl(baseUrl: string): string {
	const trimmed = baseUrl.trim().replace(/\/+$/, '');
	if (!trimmed) {
		return 'https://api.textbee.dev/api/v1';
	}
	if (/\/api\/v1(\/|$)/.test(trimmed)) {
		const idx = trimmed.indexOf('/api/v1');
		return trimmed.slice(0, idx + '/api/v1'.length);
	}
	return `${trimmed}/api/v1`;
}

/** Expression used in declarative requestDefaults / credential test */
export const baseUrlExpression =
	"={{(() => { const u = String($credentials.baseUrl || '').trim().replace(/\\/+$/, ''); if (!u) return 'https://api.textbee.dev/api/v1'; if (/\\/api\\/v1(\\/|$)/.test(u)) { const i = u.indexOf('/api/v1'); return u.slice(0, i + 7); } return u + '/api/v1'; })()}}";
