import { ChatController, chatSegments, type ChatMessage } from '@boardgamers/protocol/chat';
import { mountChat } from '@boardgamers/protocol/chat/dom';
import { attachChat, type ViewerEmitter } from '@boardgamers/protocol/viewer';
import { playerColors } from 'container-engine/src/engine';
type ChatEmitter = Pick<ViewerEmitter<any, any>, 'on' | 'emit'>;
export function mountGameChat(emitter: ViewerEmitter<any, any>, host: Element): () => void {
    const chat = new ChatController();
    const detach = attachChat(emitter, chat);
    const slot = host.querySelector<HTMLElement>('.chat-host') || document.createElement('div');
    if (!slot.parentElement) host.insertAdjacentElement('afterend', slot);
    const style = document.createElement('style');
    style.textContent = `
.bgs-game-chat{box-sizing:border-box;font:14px/1.4 Arial,sans-serif;border:1px solid #9eb4b5;border-radius:3px;margin:8px 0;padding:8px 12px;background:var(--bg-panel,#e5eeea);color:var(--text,#203a45)}
.bgs-game-chat summary{cursor:pointer;font-weight:650;border-radius:3px;width:fit-content;padding:2px 4px;margin:-2px -4px}
.bgs-game-chat summary:hover{color:#126778}
.bgs-game-chat summary:focus-visible,.bgs-game-chat button:focus-visible{outline:2px solid #247d8c;outline-offset:3px}
.bgs-game-chat .chat-day{display:flex;align-items:center;gap:8px;margin:12px 0 6px;font-size:.85em;opacity:.8}
.bgs-game-chat .chat-day::before,.bgs-game-chat .chat-day::after{content:"";flex:1;border-top:1px solid currentColor;opacity:.3}
.bgs-game-chat .chat-day time{margin:0;color:inherit;font-size:inherit}
.bgs-game-chat .chat-body{height:var(--game-panel-content-height,300px);display:flex;flex-direction:column;margin-top:8px}
.bgs-game-chat .chat-body > :not(.chat-messages){flex-shrink:0}
.bgs-game-chat .chat-messages{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;margin:0 0 8px}
.bgs-game-chat article{padding:5px 0;border-bottom:1px solid #75818d26;white-space:pre-wrap;overflow-wrap:anywhere}
.bgs-game-chat article strong{padding:0 3px;font-weight:bold}
.bgs-game-chat article:last-child{border-bottom:0}
.bgs-game-chat time{font-size:12px;color:#536e77;margin-left:8px;white-space:nowrap}
.bgs-game-chat .chat-composer{display:flex;gap:6px;align-items:center;margin:0}
.bgs-game-chat input{flex:1;min-width:0;box-sizing:border-box;height:30px;background:#f2f4ee;color:#203a45;border:1px solid #899997;border-radius:2px;padding:4px 7px;font:14px Arial,sans-serif}
.bgs-game-chat input::placeholder{color:#637477}
.bgs-game-chat input:focus{outline:2px solid #527f89;outline-offset:1px}
.bgs-game-chat button{box-sizing:border-box;height:30px;cursor:pointer;border:1px solid #7f8c8d;border-radius:3px;background:#dddeda;color:#172d34;padding:3px 12px;font:14px Arial,sans-serif}
.bgs-game-chat button:hover:not(:disabled){background:#c8d3d0}
.bgs-game-chat button:disabled{color:#788786;border-color:#b0bcb8;background:#dce3df;cursor:default}
.bgs-game-chat .chat-mention{height:auto;padding:0 2px;border:0;background:transparent;color:inherit;font:inherit;font-weight:bold;text-decoration:underline}
.bgs-game-chat article a{color:inherit;text-decoration:underline}
.chat-suggestions{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}
.chat-suggestions:empty{display:none}
.chat-suggestions button[aria-pressed="true"]{outline:2px solid #527f89}
.bgs-game-chat .chat-status{font-size:12px;margin-top:6px}
.bgs-game-chat .chat-status:empty{display:none}
.chat-shortcut{position:fixed;left:16px;bottom:max(16px,env(safe-area-inset-bottom));z-index:900;padding:7px 12px;border:1px solid #6a8589;border-radius:3px;background:#203a45;color:#fff;font:600 14px Arial,sans-serif;cursor:pointer;box-shadow:0 2px 6px #0003}
.chat-shortcut[hidden]{display:none}
.chat-shortcut:hover{background:#315966}
.chat-shortcut:focus-visible{outline:2px solid #fff;outline-offset:2px}

`;
    slot.append(style);
    let players: { id: number; name: string; color?: string; faction?: string }[] = [];
    let localPlayer: number | undefined;
    let chatVisible = false;
    const shortcut = document.createElement('button');
    shortcut.type = 'button';
    shortcut.className = 'chat-shortcut';
    shortcut.hidden = true;
    (host.querySelector('.chat-shortcut-host') || slot).append(shortcut);
    const panels = host.querySelector<HTMLElement>('.journal-and-chat');
    const tabs = host.querySelector<HTMLElement>('.mobile-panel-tabs');
    const journalTab = document.createElement('button');
    const chatTab = document.createElement('button');
    if (tabs && panels) {
        tabs.setAttribute('role', 'tablist');
        tabs.setAttribute('aria-label', 'Journal and chat');
        for (const [button, name] of [
            [journalTab, 'Journal'],
            [chatTab, 'Chat'],
        ] as const) {
            button.type = 'button';
            button.textContent = name;
            button.setAttribute('role', 'tab');
            button.setAttribute('aria-controls', name === 'Chat' ? 'container-chat-panel' : 'container-journal-panel');
            button.onclick = () => selectPanel(name === 'Chat' ? 'chat' : 'journal');
            button.onkeydown = (event) => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                event.preventDefault();
                const next =
                    event.key === 'Home'
                        ? journalTab
                        : event.key === 'End'
                        ? chatTab
                        : button === chatTab
                        ? journalTab
                        : chatTab;
                next.click();
                next.focus();
            };
            tabs.append(button);
        }
        panels.dataset.mobilePanel = 'journal';
        journalTab.setAttribute('aria-selected', 'true');
        chatTab.setAttribute('aria-selected', 'false');
        chatTab.tabIndex = -1;
    }
    function selectPanel(panel: 'journal' | 'chat') {
        if (panels) panels.dataset.mobilePanel = panel;
        journalTab.setAttribute('aria-selected', String(panel === 'journal'));
        chatTab.setAttribute('aria-selected', String(panel === 'chat'));
        journalTab.tabIndex = panel === 'journal' ? 0 : -1;
        chatTab.tabIndex = panel === 'chat' ? 0 : -1;
        if (panel === 'chat') view.open();
        else {
            const journal = panels?.querySelector<HTMLDetailsElement>('.inline-game-log');
            if (journal) journal.open = true;
        }
    }
    const view = mountChat(slot, {
        chat,
        styles: false,
        openPlayer: (index) => emitter.emit('player:clicked', { index }),
        renderAuthor,
        onVisibilityChange(visible) {
            chatVisible = visible;
            updateShortcut();
        },
    });
    // Keep the message list flexible so the composer, suggestions and status
    // fit inside the same panel height as the journal.
    const body = document.createElement('div');
    body.className = 'chat-body';
    body.append(...Array.from(view.element.children).filter((child) => child.tagName !== 'SUMMARY'));
    view.element.append(body);
    function renderAuthor(message: ChatMessage): Node {
        const author = document.createElement('strong');
        author.textContent = message.author || 'Game';
        const index =
            message.playerIndex ??
            (message.author === 'You' ? localPlayer : players.find((p) => p.name === message.author)?.id);
        if (index !== undefined && playerColors[index]) {
            author.style.backgroundColor = playerColors[index];
            author.style.color = author.style.backgroundColor === 'brown' ? '#fff' : '#111';
        }
        return author;
    }
    function updateShortcut() {
        const count = chat.unread;
        const label = count ? `Chat · ${count} unread` : 'Chat';
        chatTab.textContent = count ? `Chat · ${count}` : 'Chat';
        shortcut.textContent = label;
        shortcut.hidden = count === 0 || chatVisible;
        shortcut.setAttribute('aria-label', `Open ${label}`);
    }
    shortcut.onclick = () => selectPanel('chat');
    const mobile = window.matchMedia('(max-width: 700px)');
    const expandMobilePanels = () => {
        if (!mobile.matches) return;
        chat.setOpen(true);
        const journal = panels?.querySelector<HTMLDetailsElement>('.inline-game-log');
        if (journal) journal.open = true;
    };
    mobile.addEventListener('change', expandMobilePanels);
    expandMobilePanels();
    const dispose = [
        () => mobile.removeEventListener('change', expandMobilePanels),
        detach,
        chat.subscribe(updateShortcut),
        emitter.on('state', (state) => {
            players = (state?.players || []).map((player: any, index: number) => ({ ...player, id: index }));
            view.refresh();
        }),
        emitter.on('gamelog', ({ data }: any) => {
            if (data?.state) {
                players = (data.state.players || []).map((player: any, index: number) => ({ ...player, id: index }));
                view.refresh();
            }
        }),
        emitter.on('player', (player) => {
            localPlayer = player?.index;
            view.refresh();
        }),
    ];
    return () => {
        dispose.forEach((cleanup) => cleanup());
        view.destroy();
        journalTab.remove();
        chatTab.remove();
        if (panels) delete panels.dataset.mobilePanel;
        shortcut.remove();
        style.remove();
    };
}

export function installLocalChat(emitter: ChatEmitter): void {
    let seat = 0;
    let roster: { id: string; name: string; playerIndex: number }[] = [];
    emitter.on('player', (player) => {
        seat = player.index ?? 0;
    });
    emitter.on('state', (state) => {
        roster = (state?.players || []).map((player: any, index: number) => ({
            id: String(index),
            name: player.name || `Player ${index + 1}`,
            playerIndex: index,
        }));
        emitter.emit('chat:state', { canSend: true, mentions: roster.filter((player) => player.playerIndex !== seat) });
    });
    emitter.emit('chat:state', { canSend: true });
    emitter.emit('chat:messages', [
        {
            _id: '000000000000000000000001',
            type: 'system',
            author: 'Playtest',
            text: 'Local chat preview. Messages stay in this browser.',
            createdAt: new Date().toISOString(),
        },
    ]);
    let next = 2;
    emitter.on('chat:send', ({ text, requestId }) => {
        emitter.emit('chat:appended', [
            {
                _id: (next++).toString(16).padStart(24, '0'),
                type: 'text',
                author: 'You',
                playerIndex: seat,
                text,
                segments: chatSegments(text, new Map(roster.map((player) => [player.name, player.id])), true),
                createdAt: new Date().toISOString(),
            },
        ]);
        if (requestId) emitter.emit('chat:result', { requestId, ok: true });
    });
}
