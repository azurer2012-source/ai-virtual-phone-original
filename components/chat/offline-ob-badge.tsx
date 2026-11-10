"use client";
import { useEffect, useState } from 'react';
import { loadMcpServers } from '@/lib/tool-storage';
import { OFFLINE_OB_PREFIX, OFFLINE_OB_PROGRESS_EVENT, loadOfflineObLedger } from '@/lib/offline-ob-progress';
export function useOfflineObStatuses(sessionId: string) {
    const [statuses, setStatuses] = useState<Map<string, string>>(new Map());
    useEffect(() => {
        const refresh = () => {
            const next = new Map<string, string>();
            for (const server of loadMcpServers()) for (const row of Object.values(loadOfflineObLedger(OFFLINE_OB_PREFIX + sessionId + ':' + server.id))) {
                for (const id of row.turnIds) {
                    const label = row.status !== 'done' ? 'OB待核对' : row.skipped === undefined ? '已处理' : row.skipped ? '已跳过' : '已存OB';
                    if (next.get(id) !== '已存OB') next.set(id, label);
                }
            }
            setStatuses(next);
        };
        refresh(); window.addEventListener(OFFLINE_OB_PROGRESS_EVENT, refresh);
        return () => window.removeEventListener(OFFLINE_OB_PROGRESS_EVENT, refresh);
    }, [sessionId]);
    return statuses;
}
