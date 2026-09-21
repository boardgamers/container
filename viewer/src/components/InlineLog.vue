<template>
    <details class="inline-game-log" open>
        <summary>Journal</summary>
        <div ref="feed" class="journal-feed" @scroll="onScroll">
            <div v-for="(entry, index) in entries" :key="index" class="journal-entry" v-html="entry" />
            <div v-if="!entries.length">No actions yet.</div>
        </div>
    </details>
</template>
<script lang="ts">
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
@Component
export default class InlineLog extends Vue {
    @Prop({ default: () => [] }) entries!: string[];
    follow = true;
    resizeObserver?: ResizeObserver;
    mounted() {
        this.$nextTick(this.scrollToLatest);
        // A viewer can mount while its iframe is still hidden. Follow the end
        // once the feed is visible and its scroll dimensions are available.
        this.resizeObserver = new ResizeObserver(() => {
            if (this.follow) this.scrollToLatest();
        });
        this.resizeObserver.observe(this.$refs.feed as HTMLElement);
    }
    beforeDestroy() {
        this.resizeObserver?.disconnect();
    }
    @Watch('entries') changed() {
        if (this.follow) {
            this.$nextTick(this.scrollToLatest);
        }
    }
    scrollToLatest() {
        const feed = this.$refs.feed as HTMLElement;
        if (feed) {
            feed.scrollTop = feed.scrollHeight;
        }
    }
    onScroll() {
        const feed = this.$refs.feed as HTMLElement;
        if (!feed.clientHeight) return;
        this.follow = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 32;
    }
}
</script>
<style scoped>
.inline-game-log {
    box-sizing: border-box;
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #75818d66;
    border-radius: 6px;
    background: #e5eeea;
    color: #203a45;
    font: 14px/1.4 system-ui;
}
summary {
    cursor: pointer;
    font-weight: 600;
}
.journal-feed {
    height: var(--game-panel-content-height, 300px);
    overflow: auto;
    overflow-anchor: none;
    margin-top: 8px;
}
.journal-entry {
    padding: 5px 0;
    border-bottom: 1px solid #75818d33;
}
</style>
