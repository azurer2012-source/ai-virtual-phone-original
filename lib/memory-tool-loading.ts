const CORE_MEMORY_TOOLS = new Set(['breath', 'breath_search', 'hold', 'grow', 'trace', 'plan']);
/** Recognize the OB capability set, not the user's editable server name. */
export function isOmbreToolset(tools: { name: string }[]): boolean {
    const names = new Set(tools.map(tool => tool.name));
    return ['breath', 'hold', 'grow', 'trace', 'pulse'].every(name => names.has(name));
}
export function isCoreMemoryTool(name: string): boolean {
    return CORE_MEMORY_TOOLS.has(name);
}
