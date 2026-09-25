const marks: Record<string, string> = {
    brown: 'M2 2H8V8H2Z',
    orange: 'M5 1L9 8H1Z',
    tan: 'M5 1L9 5L5 9L1 5Z',
    white: 'M5 1V9M1 5H9',
    darkslategray: 'M5 1a4 4 0 1 0 0 8a4 4 0 1 0 0-8',
};

export function colorMarkPath(color = ''): string {
    return marks[color] ?? '';
}

export function colorMarkSvg(color = ''): string {
    const path = colorMarkPath(color);
    return path
        ? `<svg class="color-mark" viewBox="0 0 10 10" width="10" height="10" aria-hidden="true"><rect width="10" height="10" rx="1" fill="#fff"/><path d="${path}" fill="none" stroke="#172d34" stroke-width="1.5" stroke-linejoin="round"/></svg>`
        : '';
}

export function colorBadgeHtml(color: string, enabled: boolean): string {
    if (!marks[color]) return '';
    return `<span class="container-color-badge" style="display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;width:24px;height:14px;border:1px solid #21343b;background:${color}" title="${
        color === 'darkslategray' ? 'dark green' : color
    }">${enabled ? colorMarkSvg(color) : ''}</span>`;
}
