import { cargoLocations, OffshoreMotion } from '@/offshore-motion';
import { move, setup } from 'container-engine';
import { MoveName } from 'container-engine/src/move';
import { describe, expect, it, vi } from 'vitest';

function fixture() {
    const before = setup(3, { offshoreIsland: true }, 'motion');
    const piece = before.offshoreBank!.containerLots[0][0];
    const after = JSON.parse(JSON.stringify(before));
    after.offshoreBank.containerLots[0].shift();
    after.players[0].bankHolding = [piece];
    const root = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const matrix = { a: 1, b: 0, c: 0, d: 1, e: 10, f: 20 };
    Object.assign(root, { getCTM: () => ({ inverse: () => ({ multiply: (m: unknown) => m }) }) });
    const node = () => {
        const element = document.createElementNS(root.namespaceURI, 'g');
        element.setAttribute('data-piece-id', piece.id);
        const animation = { cancel: vi.fn(), onfinish: null, oncancel: null };
        const animate = vi.fn(() => animation);
        Object.assign(element, { getCTM: () => matrix, animate });
        root.replaceChildren(element);
        return { element, animate, animation };
    };
    node();
    const motion = new OffshoreMotion();
    const callbacks: Array<() => void> = [];
    const tick = (fn: () => void) => callbacks.push(fn);
    return { before, after, piece, root, node, motion, callbacks, tick };
}

describe('offshore physical cargo motion', () => {
    it('tracks physical ownership across lots, holding, ship and returns', () => {
        const { before, after, piece } = fixture();
        expect(cargoLocations(before).get(piece.id)).toBe('bank:lot:0');
        expect(cargoLocations(after).get(piece.id)).toBe('bank:holding:0');
        after.players[0].bankHolding = [];
        after.players[0].ship.containers.push(piece);
        expect(cargoLocations(after).get(piece.id)).toBe('ship:0');
    });
    it('animates the real replacement node and cancels on teardown', () => {
        const f = fixture();
        f.motion.transition(f.root, f.before, f.after, f.tick);
        const destination = f.node();
        f.callbacks.forEach((fn) => fn());
        expect(destination.animate).toHaveBeenCalledOnce();
        expect(f.root.querySelectorAll('[data-piece-id]')).toHaveLength(1);
        expect(destination.animate.mock.calls[0]).toBeDefined();
        f.motion.destroy();
        expect(destination.animation.cancel).toHaveBeenCalledOnce();
    });
    it('animates a legal bank-lot settlement with its pass and upkeep event', () => {
        const f = fixture();
        const game = f.before;
        const bidder = game.currentPlayers[0];
        move(game, { name: MoveName.CallBank, data: { type: 'containers', lot: 0 }, extraData: { cash: 1 } }, bidder);
        const pass = () => move(game, { name: MoveName.Pass, data: true }, game.currentPlayers[0]);
        pass();
        pass();
        const beforeLength = game.log.length;
        f.motion.transition(f.root, null, game, f.tick);
        pass(); // Mutates in place, with one move AND a settlement event.
        expect(game.log.length - beforeLength).toBeGreaterThan(1);
        expect(game.log.slice(beforeLength).filter((entry) => entry.type === 'move')).toHaveLength(1);
        expect(game.players[bidder].bankHolding!.map((piece) => piece.id)).toContain(f.piece.id);
        f.motion.transition(f.root, game, game, f.tick);
        const destination = f.node();
        f.callbacks.forEach((fn) => fn());
        expect(destination.animate).toHaveBeenCalledOnce();
        f.motion.destroy();
    });
    it('still skips backwards history and jumps over multiple moves', () => {
        for (const backwards of [false, true]) {
            const f = fixture();
            const game = JSON.parse(JSON.stringify(f.before));
            move(game, { name: MoveName.Pass, data: true }, game.currentPlayers[0]);
            move(game, { name: MoveName.Pass, data: true }, game.currentPlayers[0]);
            if (backwards) f.before.log = game.log;
            else f.after.log = game.log;
            f.motion.transition(f.root, f.before, f.after, f.tick);
            const destination = f.node();
            f.callbacks.forEach((fn) => fn());
            expect(destination.animate).not.toHaveBeenCalled();
            f.motion.destroy();
        }
    });
    it('does not animate initial render, layout-only changes or pagination', () => {
        const f = fixture();
        f.motion.transition(f.root, null, f.before, f.tick);
        f.motion.transition(f.root, f.before, f.before, f.tick);
        expect(f.callbacks).toHaveLength(0);
        f.motion.destroy();
    });
    it('invalidates pending work on a rapid update or teardown', () => {
        const f = fixture();
        f.motion.transition(f.root, f.before, f.after, f.tick);
        const destination = f.node();
        f.motion.transition(f.root, f.after, f.after, f.tick);
        f.callbacks.forEach((fn) => fn());
        expect(destination.animate).not.toHaveBeenCalled();
        f.motion.destroy();
    });
    it('does not layer a second animation onto a persistent Piece node', () => {
        const f = fixture();
        const destination = f.node();
        f.motion.transition(f.root, f.before, f.after, f.tick);
        f.callbacks.forEach((fn) => fn());
        expect(destination.animate).not.toHaveBeenCalled();
        f.motion.destroy();
    });
    it('retains the prior locations when the engine mutates its input in place', () => {
        const f = fixture();
        f.motion.transition(undefined, null, null, f.tick);
        f.motion.transition(f.root, null, f.before, f.tick);
        Object.assign(f.before, f.after);
        f.motion.transition(f.root, f.before, f.before, f.tick);
        const destination = f.node();
        f.callbacks.forEach((fn) => fn());
        expect(destination.animate).toHaveBeenCalledOnce();
        f.motion.destroy();
    });
    it('honors reduced motion', () => {
        vi.stubGlobal('matchMedia', () => ({ matches: true }));
        const f = fixture();
        f.motion.transition(f.root, f.before, f.after, f.tick);
        expect(f.callbacks).toHaveLength(0);
        f.motion.destroy();
        vi.unstubAllGlobals();
    });
});
