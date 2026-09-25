import { createViewer } from '@boardgamers/protocol/viewer';
import type { GameState, Move } from 'container-engine';
import { EventEmitter } from 'events';
import Vue from 'vue';
import Game from './components/Game.vue';
import { mountGameChat } from './game-chat';
import { createBoardThumbnail, installPlayerCards } from './host-presentation';
import { mountLocalization } from './localization';
import { installActionSounds } from './sounds';
import type { Preferences } from './types/ui-data';

let dispose: (() => void) | undefined;

export function destroyViewer() {
    const cleanup = dispose;
    dispose = undefined;
    cleanup?.();
}

function launch(selector: string) {
    const target = document.querySelector(selector);
    if (!target) throw new Error(`Viewer mount point not found: ${selector}`);
    destroyViewer();
    const mountPoint = document.createElement('div');
    target.append(mountPoint);
    let params: {
        state: null | GameState;
        player?: number;
        emitter: EventEmitter;
        preferences: Preferences;
    } = {
        state: null,
        emitter: new EventEmitter(),
        // Observable so preference changes update the UI immediately: Game receives
        // this object as a prop, and Vue 2 does not deep-observe prop values coming
        // from a non-reactive parent — plain-object mutations (the in-game sound/help
        // toggles, platform preference pushes) would only paint on the next re-render.
        preferences: Vue.observable({
            sound: true,
            colorBlind: false,
            disableHelp: false,
        }),
    };

    const app = new Vue({
        render: (h) => h(Game, { props: params }, []),
    }).$mount(mountPoint);

    const thumbnail = createBoardThumbnail(app.$el);
    const localization = mountLocalization(target.ownerDocument.body);
    const viewer = createViewer<GameState, Move[]>({
        async onThumbnail(size) {
            await app.$nextTick();
            return thumbnail.render(app.$el.querySelector('#scene'), size, '#c6deda', '[data-thumbnail-omit]');
        },
        async onState(data) {
            localization.setState(data);
            params.state = data;
            app.$forceUpdate();
            await app.$nextTick();
        },
        onPlayer(data) {
            params.player = data.index;
            app.$forceUpdate();
        },
        onPreferences(data) {
            localization.setLocale(data.locale);
            Object.assign(params.preferences, data);
            app.$forceUpdate();
        },
        async onLog(logData) {
            const data = logData.data as { state?: GameState } | undefined;
            // Tentative purchases are echoed only to the acting viewer.
            if (data?.state) {
                params.state = data.state;
                app.$forceUpdate();
                await app.$nextTick();
            } else viewer.fetchState();
        },
    });
    const item = viewer.emitter;
    params.emitter.on('move', (moves: Move[]) => viewer.move(moves));
    params.emitter.on('fetchState', () => viewer.fetchState());
    params.emitter.on('addLog', (data: string[]) => viewer.addLog(data));
    params.emitter.on('replaceLog', (data: string[]) => viewer.replaceLog(data));
    params.emitter.on('replay:info', (info) => viewer.setReplayInfo(info));
    params.emitter.on('update:preference', ({ name, value }) => viewer.updatePreference(name, value));
    installActionSounds(item);
    const removeCards = installPlayerCards(app.$el, viewer);
    const removeChat = mountGameChat(item, app.$el);
    app.$once('hook:beforeDestroy', () => {
        localization.destroy();
        removeCards();
        thumbnail.destroy();
        removeChat();
        viewer.destroy();
        params.emitter.removeAllListeners();
    });
    dispose = () => {
        app.$destroy();
        target.replaceChildren();
    };
    return item;
}

export default launch;
