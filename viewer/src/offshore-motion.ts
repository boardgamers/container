import { ContainerPiece, GameState } from 'container-engine/src/gamestate';

/** Logical ownership, not screen position: pagination and layout changes are not moves. */
export function cargoLocations(state?: GameState | null): Map<string, string> {
    const result = new Map<string, string>();
    if (!state?.options.offshoreIsland) return result;
    const add = (pieces: ContainerPiece[], location: string) =>
        pieces.forEach((piece) => result.set(piece.id, location));
    state.players.forEach((player, i) => {
        add(
            player.containersOnFactoryStore.map((c) => c.piece),
            `factory:${i}`
        );
        add(
            player.containersOnWarehouseStore.map((c) => c.piece),
            `warehouse:${i}`
        );
        add(player.ship.containers, `ship:${i}`);
        add(player.containersOnIsland, `island:${i}`);
        add(player.bankHolding || [], `bank:holding:${i}`);
    });
    const bank = state.offshoreBank;
    bank?.containerLots.forEach((pieces, i) => add(pieces, `bank:lot:${i}`));
    bank?.auctions.forEach((auction) =>
        add(
            auction.containers.map((c) => c.container.piece),
            `bank:escrow:${auction.type}:${auction.lot}`
        )
    );
    // Seizure choices still belong to their original store until actually seized.
    if (bank?.decision && bank.decision.kind !== 'seize') {
        add(
            bank.decision.containers.map((c) => c.container.piece),
            `bank:${bank.decision.kind}`
        );
        add(bank.decision.payment, 'bank:payment');
    }
    return result;
}

function visibleCargo(root: Element): Map<string, SVGGraphicsElement> {
    const nodes = new Map<string, SVGGraphicsElement>();
    const duplicates = new Set<string>();
    root.querySelectorAll<SVGGraphicsElement>('[data-piece-id]').forEach((node) => {
        const id = node.getAttribute('data-piece-id')!;
        // Drafts and seizure choices are UI copies, not the physical container.
        if (!/^C\d+$/.test(id) || node.closest('.bank-lot-draft')) return;
        if (node.closest('.bank-decision')?.querySelector('[aria-label^="Select for loan default"]')) return;
        if (nodes.has(id)) duplicates.add(id);
        else nodes.set(id, node);
    });
    duplicates.forEach((id) => nodes.delete(id));
    return nodes;
}

/** FLIP on the real destination SVG nodes. No ghosts, state delays, or move queue. */
export class OffshoreMotion {
    private animations = new Set<Animation>();
    private revision = 0;
    private disposed = false;
    // engineMove mutates G in-place before replaceState; retain logical snapshots independently.
    private locations?: Map<string, string>;
    private logLength?: number;
    private media =
        typeof window !== 'undefined' && typeof window.matchMedia === 'function'
            ? window.matchMedia('(prefers-reduced-motion: reduce)')
            : undefined;
    private onMotionPreference = () => {
        if (this.media?.matches) {
            ++this.revision;
            this.cancel();
        }
    };

    constructor() {
        this.media?.addEventListener?.('change', this.onMotionPreference);
    }

    transition(
        root: Element | undefined,
        before: GameState | null | undefined,
        after: GameState | null | undefined,
        nextTick: (callback: () => void) => void
    ) {
        const revision = ++this.revision;
        const previous = this.locations || cargoLocations(before);
        const next = cargoLocations(after);
        const logDelta = (after?.log.length ?? 0) - (this.logLength ?? before?.log.length ?? after?.log.length ?? 0);
        this.locations = next;
        this.logLength = after?.log.length;
        const origins = new Map<string, DOMMatrix>();
        const oldNodes = new Map<string, SVGGraphicsElement>();
        const reduced = () => !!this.media?.matches;

        if (root && !reduced() && logDelta >= 0 && logDelta <= 1) {
            visibleCargo(root).forEach((node, id) => {
                const from = previous.get(id);
                const to = next.get(id);
                if (from && to && from !== to && (from.startsWith('bank:') || to.startsWith('bank:'))) {
                    const matrix = node.getCTM?.();
                    if (matrix) {
                        origins.set(id, matrix);
                        oldNodes.set(id, node);
                    }
                }
            });
        }
        this.cancel();
        if (!root || !origins.size || this.disposed) return;
        nextTick(() => {
            if (this.disposed || revision !== this.revision || reduced()) return;
            visibleCargo(root).forEach((node, id) => {
                const origin = origins.get(id);
                const parent = (node.parentNode as SVGGraphicsElement).getCTM?.();
                const destination = node.getCTM?.();
                // Persistent pieces already have Piece.vue's own movement tween.
                if (!origin || oldNodes.get(id) === node || !parent || !destination || !node.animate) return;
                try {
                    const inverse = parent.inverse();
                    const matrix = (value: DOMMatrix) => {
                        const m = inverse.multiply(value);
                        return `matrix(${m.a}, ${m.b}, ${m.c}, ${m.d}, ${m.e}, ${m.f})`;
                    };
                    const animation = node.animate(
                        [
                            { transform: matrix(origin), transformOrigin: '0 0' },
                            { transform: matrix(destination), transformOrigin: '0 0' },
                        ],
                        { duration: 320, easing: 'ease-out' }
                    );
                    this.animations.add(animation);
                    animation.onfinish = animation.oncancel = () => this.animations.delete(animation);
                } catch (_) {
                    // Detached/hidden SVGs can have a non-invertible CTM. State is already rendered.
                }
            });
        });
    }

    private cancel() {
        this.animations.forEach((animation) => animation.cancel());
        this.animations.clear();
    }

    destroy() {
        this.disposed = true;
        this.media?.removeEventListener?.('change', this.onMotionPreference);
        ++this.revision;
        this.cancel();
    }
}
