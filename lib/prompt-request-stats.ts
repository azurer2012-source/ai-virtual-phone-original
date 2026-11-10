/** Local-only structural counts, never a provider token estimate. No request text is retained. */
export function measurePromptRequest(body: Record<string, unknown>) {
    const size = (value: unknown) => value === undefined ? 0 : JSON.stringify(value).length;
    const messages = body.messages ?? body.contents;
    const system = body.system ?? body.systemInstruction;
    const tools = body.tools;
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
    };
}
