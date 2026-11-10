import { kvGet, kvSet } from './kv-db';
const KEY = 'ai_phone_mcp_diagnostics_v1';
export type McpDiagnostic = { time: string; method: string; tool?: string; status: number; path: string; authorizationPresent: boolean; sessionPresent: boolean; responseType: string; challenge: boolean; hints: string[] };
export function loadMcpDiagnostics(): McpDiagnostic[] { try { const rows = JSON.parse(kvGet(KEY) || '[]'); return Array.isArray(rows) ? rows.slice(-20) : []; } catch { return []; } }
export function clearMcpDiagnostics() { kvSet(KEY, '[]'); }
export function recordMcpDiagnostic(row: McpDiagnostic) {
    try { kvSet(KEY, JSON.stringify([...loadMcpDiagnostics(), row].slice(-20))); } catch { /* Diagnostics must never interrupt calls. */ }
}
export function classifyMcpResponse(text: string) {
    const html = /^\s*(?:<!doctype|<html)/i.test(text);
    return {
        responseType: html ? 'HTML' : /^[\s]*[\[{]/.test(text) ? 'JSON' : '其他',
        hints: [
            ...(text.includes('请先登录') ? ['应用登录提示'] : []),
            ...(/invalid.token|invalid_token/i.test(text) ? ['invalid_token'] : []),
            ...(/expired/i.test(text) ? ['expired'] : []),
            ...(/session/i.test(text) ? ['session'] : []),
        ],
    };
}
