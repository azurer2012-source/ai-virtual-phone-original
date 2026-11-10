/** Locate visible text without inserting nodes or changing theme markup. */
export function findRenderedText(root: HTMLElement, query: string): Range | null {
    const needle = query.replace(/\s+/g, '').toLowerCase();
    if (!needle) return null;
    const nodes: { node: Text; offset: number }[] = [];
    let text = '';
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
        const node = walker.currentNode as Text;
        const parent = node.parentElement;
        if (!parent || parent.closest('script,style,button,[aria-hidden="true"]') || !parent.getClientRects().length) continue;
        for (let offset = 0; offset < node.length; offset++) {
            if (/\s/.test(node.data[offset])) continue;
            const lower = node.data[offset].toLowerCase();
            text += lower;
            for (let i = 0; i < lower.length; i++) nodes.push({ node, offset });
        }
    }
    const index = text.indexOf(needle);
    if (index < 0) return null;
    const start = nodes[index], end = nodes[index + needle.length - 1];
    const range = document.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset + 1);
    return range;
}
