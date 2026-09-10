function pieceIcon(kind: string, color = ''): string {
    const label = `${color === 'darkslategray' ? 'dark green' : color} ${kind}`.trim();
    const shape =
        kind === 'factory'
            ? `<g transform="translate(11 11)"><circle r="10" fill="${color}" stroke="#233b43"/><path d="M-6 6 V-2 L-1 0 V-4 L4 -1 V-7 H7 V6Z" fill="#172d34" fill-opacity=".85"/><path d="M-4 2 V4 M0 2 V4 M4 2 V4" stroke="#f4eed6" stroke-width="1.3"/></g>`
            : kind === 'container'
            ? `<g transform="translate(1 6)"><rect width="20" height="10" rx=".8" fill="${color}" stroke="#21343b"/><path d="M4 2V8 M8 2V8 M12 2V8 M16 2V8" stroke="#10252b" stroke-opacity=".3" stroke-width=".7"/><path d="M1 1H19" stroke="white" stroke-opacity=".5"/></g>`
            : '<g transform="translate(1 1) scale(.66)"><path d="M15 0 L30 10 L30 30 L0 30 L0 10Z" fill="#789298" stroke="#233b43"/><path d="M0 10 L15 0 L30 10" fill="none" stroke="#344a51" stroke-width="2"/><path d="M7 30V14 H23V30" fill="#dae2da" stroke="#425c65"/><path d="M8 18H22 M8 22H22 M8 26H22" stroke="#6c8285"/></g>';
    return `<span title="${label}" style="display:inline-block;vertical-align:middle;line-height:0"><svg role="img" aria-label="${label}" width="26" height="26" viewBox="0 0 22 22"><title>${label}</title>${shape}</svg></span>`;
}

export function journalPieces(html: string): string {
    const root = document.createElement('div');
    root.innerHTML = html;
    for (const badge of Array.from(root.querySelectorAll('span'))) {
        const color = badge.textContent || '';
        const tail = badge.nextSibling;
        if (
            !badge.style.border ||
            !/^(brown|orange|tan|white|darkslategray)$/.test(color) ||
            tail?.nodeType !== Node.TEXT_NODE
        )
            continue;
        const match = tail.textContent?.match(/^ (factory container|warehouse container|factory|container)\b/);
        if (!match) continue;
        const kind = match[1].endsWith('container') ? 'container' : 'factory';
        const source =
            match[1] === 'factory container'
                ? ' at the factory'
                : match[1] === 'warehouse container'
                ? ' at the warehouse'
                : '';
        tail.textContent = source + tail.textContent!.slice(match[0].length);
        const before = badge.previousSibling;
        if (before?.nodeType === Node.TEXT_NODE) {
            before.textContent = before.textContent!.replace(/\ba $/, '');
        }
        badge.outerHTML = pieceIcon(kind, color);
    }
    for (const node of Array.from(root.childNodes)) {
        if (node.nodeType !== Node.TEXT_NODE || !node.textContent?.includes('a warehouse')) continue;
        const fragment = document.createElement('span');
        // Only replace text nodes: player names and existing markup stay intact.
        const parts = node.textContent.split(/\ba warehouse\b/);
        parts.forEach((part, i) => {
            if (i) fragment.insertAdjacentHTML('beforeend', pieceIcon('warehouse'));
            fragment.append(document.createTextNode(part));
        });
        node.replaceWith(fragment);
    }
    return root.innerHTML;
}
