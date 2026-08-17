import type { GameState, Move } from 'container-engine';
import { EventEmitter } from 'events';
import Vue from 'vue';
import Game from './components/Game.vue';
import type { Preferences } from './types/ui-data';

function launch(selector: string) {
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
            disableHelp: false,
        }),
    };

    const app = new Vue({
        render: (h) => h(Game, { props: params }, []),
    }).$mount(selector);

    const item: EventEmitter = new EventEmitter();

    // The move payload is the whole current turn so far (an array of atomic moves),
    // replayed by the engine wrapper from the last committed state.
    params.emitter.on('move', (moves: Move[]) => item.emit('move', moves));
    params.emitter.on('addLog', (data: string[]) => item.emit('addLog', data));
    params.emitter.on('replaceLog', (data: string[]) => item.emit('replaceLog', data));
    params.emitter.on('update:preference', (data: { name: string; value: any }) =>
        item.emit('update:preference', data)
    );

    item.addListener('state', (data) => {
        params.state = data;
        app.$forceUpdate();
        app.$nextTick().then(() => item.emit('ready'));
    });
    item.addListener('state:updated', () => item.emit('fetchState'));
    item.addListener('player', (data) => {
        params.player = data.index;
        app.$forceUpdate();
    });
    item.addListener('preferences', (data) => {
        // Mutate (don't replace) the observable object so the update stays reactive
        Object.assign(params.preferences, data);
        app.$forceUpdate();
    });
    item.addListener('gamelog', (logData) => {
        if (logData?.data?.state) {
            // Move responses carry the (possibly tentative) resulting state. Tentative
            // states are never persisted or broadcast by the platform — this is the only
            // way they reach the acting player's viewer.
            params.state = logData.data.state;
            app.$forceUpdate();
        } else {
            item.emit('fetchState');
        }
    });

    return item;
}

export default launch;
