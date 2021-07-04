import type { GameState, Move } from 'container-engine';
import { EventEmitter } from 'events';
import Vue from 'vue';
import Game from './components/Game.vue';

function launch(selector: string) {
    let params: {
        state: null | GameState;
        player?: number;
        emitter: EventEmitter;
    } = {
        state: null,
        emitter: new EventEmitter(),
    };

    const app = new Vue({
        render: (h) => h(Game, { props: params }, []),
    }).$mount(selector);

    const item: EventEmitter = new EventEmitter();

    params.emitter.on('uplink:move', (move: Move) => item.emit('move', move));
    params.emitter.on('uplink:replaceLog', (data: string[]) => item.emit('replaceLog', data));

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
        params.emitter.emit('preferences', data);
    });
    item.addListener('gamelog', (_) => item.emit('fetchState'));

    return item;
}

export default launch;
