export function SearchMatchText({ text, query }: { text: string; query: string }) {
    const needle = query.trim().toLowerCase();
    if (!needle) return <>{text}</>;
    const parts = [];
    const lower = text.toLowerCase();
    let start = 0, index = lower.indexOf(needle);
    while (index >= 0) {
        parts.push(text.slice(start, index));
        parts.push(<mark key={index} style={{ background: '#ffe28a', color: '#332700', borderRadius: 2, padding: 0 }}>{text.slice(index, index + needle.length)}</mark>);
        start = index + needle.length;
        index = lower.indexOf(needle, start);
    }
    parts.push(text.slice(start));
    return <>{parts}</>;
}
