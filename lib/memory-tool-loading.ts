/** Recognize the OB capability set, not the user's editable server name. */
export function isOmbreToolset(tools: { name: string }[]): boolean {
    const names = new Set(tools.map(tool => tool.name));
    return ['breath', 'hold', 'grow', 'trace', 'pulse'].every(name => names.has(name));
}
