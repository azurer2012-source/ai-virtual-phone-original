/** Local-only structural counts, never a provider token estimate. No request text is retained. */
export function measurePromptRequest(body: Record<string, unknown>, sourceMessages: { role: string; content: unknown; marker?: string }[] = []) {
    const size = (value: unknown) => value === undefined ? 0 : JSON.stringify(value).length;
    const messages = body.messages ?? body.contents;
    const system = body.system ?? body.systemInstruction;
    const tools = body.tools;
    const sourceDetails: Record<string, { count: number; chars: number }> = {};
    for (const message of sourceMessages) {
        const marker = message.marker || '未标注';
        const category = message.role === 'tool' ? '历史工具结果' : marker.includes('History [') ? '聊天历史' : marker.includes('ShortTerm Event') ? '近期事件' : marker;
        const row = sourceDetails[category] ??= { count: 0, chars: 0 };
        row.count++;
        row.chars += typeof message.content === 'string' ? message.content.length : size(message.content);
    }
    const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
    const toolDetails = (Array.isArray(tools) ? tools : []).flatMap(value => {
        const group = record(value);
        const entries = Array.isArray(group.functionDeclarations) ? group.functionDeclarations : [value];
        return entries.map(entry => {
            const definition = record(entry);
            const fn = record(definition.function ?? definition);
            return {
                name: String(fn.name ?? definition.type ?? 'unnamed').slice(0, 160),
                jsonChars: size(entry),
                descriptionChars: typeof fn.description === 'string' ? fn.description.length : 0,
                schemaJsonChars: size(fn.parameters ?? fn.input_schema ?? fn.parametersJsonSchema),
            };
        });
    }).sort((a, b) => b.jsonChars - a.jsonChars);
    const roleDetails: Record<string, { count: number; jsonChars: number }> = {};
    for (const message of Array.isArray(messages) ? messages : []) {
        const role = String(record(message).role ?? 'unknown');
        const row = roleDetails[role] ??= { count: 0, jsonChars: 0 };
        row.count++;
        row.jsonChars += size(message);
    }
    const other = Object.fromEntries(Object.entries(body).filter(([key]) =>
        !['messages', 'contents', 'system', 'systemInstruction', 'tools'].includes(key)));
    return {
        requestJsonChars: size(body),
        messagesJsonChars: size(messages),
        systemJsonChars: size(system),
        toolsJsonChars: size(tools),
        otherJsonChars: size(other),
        messageCount: Array.isArray(messages) ? messages.length : 0,
        toolGroups: Array.isArray(tools) ? tools.length : 0,
        toolDetails,
        roleDetails,
        sourceDetails,
    };
}
