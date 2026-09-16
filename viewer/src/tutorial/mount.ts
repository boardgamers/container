import { createTutorial, TutorialMount, TutorialSnapshot } from '@boardgamers/protocol/tutorial';
import { mountTutorialGuide } from '@boardgamers/protocol/tutorial/dom';
import { GameState, Move, stripSecret } from 'container-engine';
import { Phase } from 'container-engine/src/gamestate';
import { MoveName } from 'container-engine/src/move';
import { EventEmitter } from 'events';
import Vue from 'vue';
import Game from '../components/Game.vue';
import { colorName, colors, lessons, LessonState, TutorialAction } from './lessons';
import './tutorial.css';

export const mountTutorial: TutorialMount = async (target, { chapter, onProgress }) => {
    const found = lessons.find((entry) => entry.id === chapter);
    if (!found) throw Error('Unknown Container chapter');
    const lesson = found;
    target.className = 'container-tutorial';
    function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') {
        const node = document.createElement(tag);
        node.className = className;
        node.textContent = text;
        return node;
    }
    const top = element('div', 'tutorial-top');
    const guide = element('div', 'tutorial-guide');
    const feedback = element('p', 'tutorial-answer-feedback');
    feedback.setAttribute('role', 'status');
    feedback.setAttribute('aria-atomic', 'true');
    feedback.hidden = true;
    const controls = element('div', 'tutorial-actions');
    controls.dataset.tutorial = 'lesson-actions';
    controls.setAttribute('aria-label', 'Lesson actions');
    const left = element('div');
    left.append(feedback, guide, controls);
    const summary = element('aside', 'tutorial-summary');
    const gameHost = element('div', 'tutorial-game');
    const result = element('section', 'tutorial-result');
    top.append(left, summary);
    target.append(top, gameHost, result);
    const emitter = new EventEmitter();
    const params = {
        state: null as GameState | null,
        player: 0,
        emitter,
        preferences: Vue.observable({ sound: false, disableHelp: false }),
        interactionDisabled: false,
        tutorialMove: (move: Move) => {
            void play({ kind: 'move', move });
        },
    };
    const app = new Vue({ render: (h) => h(Game, { props: params }) }).$mount(gameHost.appendChild(element('div')));
    let destroyed = false;
    let animate = false;
    let latest: TutorialSnapshot<LessonState>;
    let previous: LessonState | undefined;
    let animationTimer: number | undefined;
    let finishAnimation: (() => void) | undefined;
    async function present(game: GameState) {
        if (destroyed) return;
        // Atomic tutorial moves are checkpoints; the ordinary viewer's turn buffer is not used here.
        params.state = { ...structuredClone(stripSecret(game, 0)), newTurn: true };
        app.$forceUpdate();
        await app.$nextTick();
    }
    let storage: Storage | undefined;
    try {
        storage = localStorage;
    } catch {
        /* Progress is optional. */
    }
    const controller = await createTutorial({
        ...lesson,
        storage,
        onProgress,
        async move(state, action) {
            const frames: GameState[] = [];
            const next = lesson.move(state, action, (frame) => frames.push(frame));
            if (animate) {
                for (const frame of frames) {
                    if (destroyed) break;
                    await present(frame);
                    await new Promise<void>((resolve) => {
                        finishAnimation = resolve;
                        animationTimer = window.setTimeout(
                            resolve,
                            window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 850
                        );
                    });
                    finishAnimation = undefined;
                }
            }
            return next;
        },
    });
    async function play(action: TutorialAction) {
        if (latest.busy || latest.canContinue || latest.completed || destroyed) return;
        animate = true;
        try {
            await controller.play(action);
        } finally {
            animate = false;
        }
    }
    function swatch(color: string) {
        const chip = element('span', 'tutorial-container');
        chip.style.backgroundColor = color;
        chip.setAttribute('aria-hidden', 'true');
        return chip;
    }
    function renderSummary(snapshot: TutorialSnapshot<LessonState>) {
        const game = stripSecret(snapshot.state.game, 0);
        const you = game.players[0];
        summary.replaceChildren();
        summary.append(
            element('h2', '', `${game.phase === Phase.GameEnd ? 'Your final total' : 'Your cash'}: $${you.money}`)
        );
        const values = element('div', 'tutorial-values');
        values.dataset.tutorial = 'value-card';
        values.append(element('h3', '', 'Your private value card'));
        values.append(
            element(
                'p',
                'tutorial-value-help',
                'Final scoring values per island container. Other players have different values and cannot see your card.'
            )
        );
        for (const entry of you.pointCard!.containerValues) {
            const item = element('span', 'tutorial-value');
            item.append(
                swatch(entry.containerColor),
                document.createTextNode(entry.baseValue === 5 ? '$5 or $10' : `$${entry.baseValue}`)
            );
            item.title = `${colorName(entry.containerColor)}: ${
                entry.baseValue === 5 ? '$10 with all five colours; otherwise $5' : `$${entry.baseValue} each`
            }`;
            values.append(item);
        }
        const bonus = you.pointCard!.containerValues.find((entry) => entry.baseValue === 5)!;
        values.append(
            element(
                'p',
                'tutorial-value-help',
                `${colorName(
                    bonus.containerColor
                )}: $10 each with all five colours on your island; $5 each otherwise. Check before removing your most numerous colour.`
            )
        );
        if (['keep-cargo', 'scoring'].includes(lesson.id)) summary.append(values);
        if (['supply-chain', 'buildings'].includes(lesson.id)) {
            const business = element('div', 'tutorial-business');
            business.dataset.tutorial = 'business';
            business.append(element('h3', '', 'Your buildings and stock'));
            const table = element('table');
            const heading = element('tr');
            heading.append(element('th', '', 'Buildings'), element('th', '', 'Containers for sale'));
            table.append(heading);
            for (const [label, capacity, pieces, prices] of [
                [
                    `${you.factories.length} ${you.factories.length === 1 ? 'factory' : 'factories'}`,
                    you.factories.length * 2,
                    you.containersOnFactoryStore.map((item) => item.piece),
                    '$1–4',
                ],
                [
                    `${you.warehouses.length} ${you.warehouses.length === 1 ? 'warehouse' : 'warehouses'}`,
                    you.warehouses.length,
                    you.containersOnWarehouseStore.map((item) => item.piece),
                    '$2–6',
                ],
            ] as const) {
                const row = element('tr');
                const stock = element('td');
                stock.append(element('div', '', `${pieces.length}/${capacity} spaces used`));
                pieces.forEach((piece) => stock.append(swatch(piece.color)));
                stock.append(element('small', '', `Your sale prices: ${prices}`));
                row.append(element('th', '', label), stock);
                table.append(row);
            }
            business.append(table);
            summary.append(business);
        }
        const owner =
            game.auctioningPlayer != null && game.auctioningPlayer >= 0
                ? game.auctioningPlayer
                : lesson.id === 'bidding'
                ? 1
                : 0;
        const cargo = element('div', 'tutorial-cargo');
        cargo.dataset.tutorial = 'cargo';
        cargo.append(
            element('h3', '', `${game.players[owner].name === 'You' ? 'Your' : game.players[owner].name + '’s'} ship`)
        );
        for (const piece of game.players[owner].ship.containers) cargo.append(swatch(piece.color));
        if (!game.players[owner].ship.containers.length) cargo.append(element('span', 'tutorial-muted', 'Empty'));
        summary.append(cargo);
        if (game.phase === Phase.Bid || game.phase === Phase.AcceptDecline) {
            const auction = element('div', 'tutorial-auction');
            auction.dataset.tutorial = 'auction-summary';
            auction.append(element('h3', '', 'Auction · entire shipment'));
            for (const player of game.players) {
                let label = 'Seller';
                if (player.id !== owner) {
                    const firstKnown = player.id === 0 || player.showBid;
                    const additionalKnown = player.showAdditionalBid || player.id === 0;
                    label = firstKnown ? `$${player.bid}` : 'Sealed';
                    if (game.highestBidders.length && (player.additionalBid || player.showAdditionalBid))
                        label += additionalKnown
                            ? ` + $${player.additionalBid} = $${player.bid + player.additionalBid}`
                            : ' + sealed';
                    if (game.currentPlayers.includes(player.id)) label += ' · choosing';
                }
                auction.append(element('p', '', `${player.name}: ${label}`));
            }
            summary.append(auction);
        }
        if (you.containersOnIsland.length) {
            const island = element('div', 'tutorial-island');
            island.dataset.tutorial = 'score-preview';
            island.append(element('h3', '', 'Your island'));
            for (const color of colors) {
                const count = you.containersOnIsland.filter((piece) => piece.color === color).length;
                if (!count) continue;
                const row = element('div', 'tutorial-island-row');
                if (lesson.id === 'scoring' && snapshot.state.answer === color) row.classList.add('discarded');
                row.append(swatch(color), element('span', '', `${count} ${colorName(color)}`));
                if (row.classList.contains('discarded')) row.append(element('strong', '', 'discarded · $0'));
                island.append(row);
            }
            summary.append(island);
        }
        result.replaceChildren();
        result.hidden = game.phase !== Phase.GameEnd;
        if (!result.hidden) {
            result.append(element('h2', '', 'Final score'));
            const table = element('table');
            const labels = [
                'Cash',
                'White containers',
                'Orange containers',
                'Tan containers',
                'Brown containers',
                'Dark-green containers',
                'Most numerous colour removed',
                'Warehouse stock',
                'Ship cargo',
                'Unpaid loans',
            ];
            you.finalScoreBreakdown?.forEach((value, index) => {
                const row = element('tr');
                row.append(
                    element('th', '', labels[index]),
                    element('td', '', value.replace('darkslategray', 'dark green'))
                );
                table.append(row);
            });
            const row = element('tr', 'tutorial-total');
            row.append(element('th', '', 'Your final total'), element('td', '', `$${you.money}`));
            table.append(row);
            result.append(table);
            const winner = game.players.reduce((best, player) => (player.money > best.money ? player : best));
            result.append(
                element('p', '', `${winner.name === 'You' ? 'You win' : winner.name + ' wins'} with $${winner.money}.`)
            );
        }
    }
    let controlStep = -1;
    function renderControls(snapshot: TutorialSnapshot<LessonState>) {
        const step = lesson.steps[snapshot.step]?.id ?? '';
        const answeredStep = lesson.steps[snapshot.step - 1]?.id ?? '';
        const answered =
            snapshot.state.answer === undefined
                ? undefined
                : lesson
                      .choices(snapshot.state, answeredStep)
                      .find(
                          (choice) => choice.action.kind === 'answer' && choice.action.answer === snapshot.state.answer
                      );
        feedback.textContent = answered?.correct ?? '';
        feedback.hidden = !feedback.textContent || !!snapshot.error;
        // Preserve the typed bid and focus when validation reports an error.
        if (controlStep !== snapshot.step) {
            controls.replaceChildren();
            controlStep = snapshot.step;
            if (lesson.id === 'bidding' && (step === 'bid' || step === 'raise')) {
                const form = element('div', 'tutorial-bid');
                form.setAttribute('role', 'group');
                form.setAttribute('aria-label', step === 'raise' ? 'Additional bid' : 'Your sealed bid');
                const label = element('label', '', step === 'raise' ? 'Additional bid' : 'Your sealed bid');
                const input = element('input');
                input.type = 'number';
                input.inputMode = 'numeric';
                input.min = '0';
                input.step = '1';
                input.required = true;
                input.max = String(snapshot.state.game.players[0].money - snapshot.state.game.players[0].bid);
                input.value = '';
                input.id = 'tutorial-bid-amount';
                label.htmlFor = input.id;
                const submit = element('button', '', step === 'raise' ? 'Add to my bid' : 'Bid');
                submit.type = 'button';
                const total = element('span', 'tutorial-muted');
                const update = () => {
                    total.textContent =
                        step === 'raise'
                            ? `Total: $8 + $${Number(input.value) || 0} = $${8 + (Number(input.value) || 0)}`
                            : '';
                };
                input.addEventListener('input', update);
                update();
                form.append(label, input, submit, total);
                const sendBid = () => {
                    if (!input.reportValidity()) return;
                    void play({
                        kind: 'move',
                        move: { name: MoveName.Bid, data: true, extraData: { price: Number(input.value) } },
                    });
                };
                submit.addEventListener('click', sendBid);
                input.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        sendBid();
                    }
                });
                controls.append(form);
            } else {
                for (const choice of lesson.choices(snapshot.state, step)) {
                    const button = element('button');
                    button.type = 'button';
                    if (choice.color) button.append(swatch(choice.color));
                    button.append(document.createTextNode(choice.label));
                    button.addEventListener('click', () => {
                        void play(choice.action);
                    });
                    controls.append(button);
                }
            }
        }
        controls.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button').forEach((control) => {
            control.disabled = snapshot.busy || snapshot.completed;
        });
        controls.hidden = !controls.childElementCount;
    }
    const off = controller.subscribe((snapshot) => {
        latest = snapshot;
        params.interactionDisabled = snapshot.busy || snapshot.canContinue || snapshot.completed;
        if (snapshot.state !== previous) {
            previous = snapshot.state;
            void present(snapshot.state.game);
            renderSummary(snapshot);
        }
        app.$forceUpdate();
        renderControls(snapshot);
    });
    const removeGuide = mountTutorialGuide(guide, controller);
    return () => {
        destroyed = true;
        clearTimeout(animationTimer);
        finishAnimation?.();
        removeGuide();
        off();
        controller.destroy();
        emitter.removeAllListeners();
        app.$destroy();
        target.replaceChildren();
    };
};
