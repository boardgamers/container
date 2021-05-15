import type Card from '../components/Card.vue';
import type Placeholder from '../components/Placeholder.vue';

export interface UIData {
    cards: { [key: number]: Card };
    placeholders: {
        rows: Placeholder[][];
        players: Placeholder[];
    };
    dragged?: Vue | null;
    waitingAnimations: number;
}

export interface Piece {
    id: number;
    x: number;
    y: number;
    color?: string;
    rotate?: number;
}