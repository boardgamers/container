import Game from '@/components/Game.vue';
import { journalContainerIcon, journalPieces } from '@/journal-pieces';
import fr from '@/localization/fr.json';
import { mountLocalization } from '@/localization/runtime.js';
import { offshoreJournal } from '@/offshore-journal';
import { setup, stripSecret } from 'container-engine/src/engine';
import { ContainerColor, ShipPosition } from 'container-engine/src/gamestate';
import { LogMove } from 'container-engine/src/log';
import { Move, MoveName } from 'container-engine/src/move';
import { describe, expect, it } from 'vitest';

const entry = (move: Move): LogMove => ({ type: 'move', player: 0, move, pretty: '', simple: '' });
const cashCall = () =>
    entry({ name: MoveName.CallBank, data: { type: 'cash', lot: 2 }, extraData: { containers: ['C12', 'C0', 'C36'] } });
function fixture() {
    const state = setup(3, { offshoreIsland: true }, 'journal');
    state.players[0].name = 'Draw <img src=x onerror="alert(1)"> & "Ada"';
    return state;
}
function render(log: LogMove, state = fixture(), blind = true) {
    const root = document.createElement('div');
    root.innerHTML = journalPieces(offshoreJournal(log, state, true, blind)!, blind, ['#123456']);
    return root;
}

describe('Offshore rich journal', () => {
    it('matches ordinary badges, applies custom colors, escapes names exactly once and lists escrow pictograms', () => {
        const state = fixture();
        const root = render(cashCall(), state);
        const badge = root.querySelector('[data-localized-journal] > span')! as HTMLElement;
        expect(badge.textContent).toBe(state.players[0].name);
        expect(badge.style.backgroundColor).toBe('rgb(18, 52, 86)');
        expect(badge.style.fontWeight).toBe('bold');
        expect(root.querySelector('img')).toBeNull();
        expect(root.querySelectorAll('svg[role="img"]')).toHaveLength(3);
        expect(root.querySelectorAll('.color-mark')).toHaveLength(3);
        expect([...root.querySelectorAll('svg[role="img"]')].map((el) => el.getAttribute('aria-label'))).toEqual([
            'brown container',
            'orange container',
            'dark green container',
        ]);
        expect(render(cashCall(), state, false).querySelector('.color-mark')).toBeNull();
        const ordinary = journalPieces(
            '<span style="background-color:dodgerblue;font-weight:bold;padding:0 3px">Ada</span> produces a <span style="border:1px solid black">brown</span> container',
            true,
            ['#123456']
        );
        const normal = document.createElement('div');
        normal.innerHTML = ordinary;
        expect(root.querySelector('svg[role="img"]')!.outerHTML).toBe(
            normal.querySelector('svg[role="img"]')!.outerHTML
        );
    });

    it('survives settled escrow, stripped states and replay without consulting current pieces', () => {
        const state = fixture();
        const call = cashCall();
        state.log = [call];
        const before = render(call, state).innerHTML;
        state.offshoreBank!.auctions = [];
        state.containersLeft = [];
        for (const p of state.players) {
            p.containersOnFactoryStore = [];
            p.containersOnWarehouseStore = [];
        }
        const publicState = stripSecret(JSON.parse(JSON.stringify(state)), 1);
        expect(render(publicState.log[0] as LogMove, publicState).innerHTML).toBe(before);
        const context = { G: publicState, preferences: { colorBlind: true }, playerColors: ['#123456'] };
        expect((Game as any).options.computed.logReversed.get.call(context)[0]).toBe(before);
    });

    it('uses public historical piece snapshots before the stable-ID fallback', () => {
        const state = fixture();
        const call = cashCall();
        state.log = [
            entry({ name: MoveName.LoadBankContainer, data: { id: 'C12', color: ContainerColor.White } }),
            call,
        ];
        expect(render(call, state).querySelector('svg[role="img"]')!.getAttribute('aria-label')).toBe(
            'white container'
        );
    });

    it.each([
        MoveName.ReturnBankContainer,
        MoveName.DistributeBankContainer,
        MoveName.SeizeBankContainer,
        MoveName.LoadBankContainer,
    ] as const)('renders %s with a badge and pictogram', (name) => {
        const log = entry({ name, data: { id: 'C36', color: ContainerColor.Black }, extraData: { price: 3 } });
        const root = render(log);
        expect(root.querySelectorAll('svg[role="img"]')).toHaveLength(1);
        expect(root.querySelector('.color-mark')).not.toBeNull();
        if (name === MoveName.ReturnBankContainer) expect(root.textContent).toContain('$3');
        delete (log.move.data as any).color;
        expect(render(log).innerHTML).toBe(root.innerHTML);
    });

    it('preserves French prose and opaque player/icon slots across locale switches', () => {
        const state = fixture();
        const root = render(cashCall(), state);
        document.body.append(root);
        const localization = mountLocalization(root, { fr }, 'fr');
        expect(root.textContent).toContain('appelle la banque');
        expect(root.textContent).toContain(state.players[0].name);
        expect(root.querySelectorAll('.color-mark')).toHaveLength(3);
        localization.setLocale('en');
        expect(root.textContent).toContain('calls bank');
        expect(root.textContent).toContain(state.players[0].name);
        localization.destroy();
    });

    it('keeps cash and plain text logs intact, badges sailing, and rejects injected metadata', () => {
        const state = fixture();
        const call = entry({ name: MoveName.CallBank, data: { type: 'containers', lot: 0 }, extraData: { cash: 7 } });
        expect(render(call, state).textContent).toContain('$7 in escrow.');
        expect(offshoreJournal(cashCall(), state)).toContain('3 containers in escrow.');
        expect(render(entry({ name: MoveName.Sail, data: ShipPosition.OffshoreBank })).textContent).toContain(
            'sails to the offshore bank.'
        );
        (call.move as any).extraData.cash = '<img src=x onerror=alert(1)>';
        expect(render(call).querySelector('img')).toBeNull();
        expect(journalContainerIcon('" onload="alert(1)' as ContainerColor)).toBe('');
        expect(
            offshoreJournal(entry({ name: MoveName.Bid, data: true, extraData: { price: 99 } }), state, true)
        ).toBeUndefined();
    });
});
