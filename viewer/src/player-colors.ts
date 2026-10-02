import { playerSymbolGlyph } from '@boardgamers/protocol/player-symbols';
import { playerColors as defaults } from 'container-engine/src/engine';
import type { Preferences } from './types/ui-data';

export function playerColors(preferences: Pick<Preferences, 'bgs'>): string[] {
    return defaults.map((color, index) => {
        const custom = preferences.bgs?.playerColors?.[index];
        return custom && /^#[a-f0-9]{6}$/i.test(custom) ? custom : color;
    });
}

export function playerTextColor(color = ''): string {
    if (!/^#[a-f0-9]{6}$/i.test(color)) return '#111';
    const luminance = [1, 3, 5].map((offset) => {
        const channel = parseInt(color.slice(offset, offset + 2), 16) / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return luminance[0] * 0.2126 + luminance[1] * 0.7152 + luminance[2] * 0.0722 > 0.179 ? '#111' : '#fff';
}

export function playerSymbol(index: number, preferences: { bgs?: { playerSymbols?: string[] } }): string {
    return playerSymbolGlyph(preferences.bgs?.playerSymbols?.[index], String(index + 1));
}
