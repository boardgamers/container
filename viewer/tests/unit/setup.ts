import { afterEach } from 'vitest';
import Vue from 'vue';

Vue.config.productionTip = false;
Vue.config.devtools = false;

// Vue Test Utils 1 does not remove nodes mounted with attachTo automatically.
// Keep Vitest's jsdom instance isolated between test files and test cases.
afterEach(() => {
    document.body.innerHTML = '';
});
