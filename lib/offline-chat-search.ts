import type { ChatOfflineTurn } from './chat-offline-storage';

export function offlineSearchText(value: string): string {
    return value.replace(/<(script|style|thinking|think|reasoning)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
        .replace(/<br\s*\/?\s*>|<\/(?:p|div|li|span)>/gi, '\n')
        .replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&amp;/gi, '&')
        .replace(/〔(?:\/?诗|行|节)〕/g, '\n').replace(/\s+/g, ' ').trim();
}

export function searchOfflineTurns(turns: ChatOfflineTurn[], query: string, limit = 100) {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return [];
    return [...turns].sort((a,b) => b.createdAt.localeCompare(a.createdAt)).flatMap(turn => {
        const fields = [turn.userContent, turn.assistantContent, turn.summary].map(offlineSearchText);
        const match = fields.find(text => text.toLocaleLowerCase().includes(needle));
        if (!match) return [];
        const start = Math.max(0, match.toLocaleLowerCase().indexOf(needle) - 45);
        return [{ id: turn.id, createdAt: turn.createdAt, excerpt: `${start ? '…' : ''}${match.slice(start, start + 220)}${match.length > start + 220 ? '…' : ''}`, summaryOnly: !fields.slice(0,2).some(text => text.toLocaleLowerCase().includes(needle)) }];
    }).slice(0, limit);
}
