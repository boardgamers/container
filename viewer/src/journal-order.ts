import { LogItem, LogMove } from 'container-engine/src/log';
import { MoveName } from 'container-engine/src/move';

/** Order revealed bids for display only; replay must retain the actual move order. */
export function journalOrder(log: readonly LogItem[]): LogItem[] {
    const result = [...log];
    let slots: number[] = [];
    const seats = new Set<number>();
    const flush = () => {
        const bids = slots.map((index) => log[index] as LogMove).sort((a, b) => a.player - b.player);
        slots.forEach((index, i) => (result[index] = bids[i]));
        slots = [];
        seats.clear();
    };
    log.forEach((entry, index) => {
        if (entry.type === 'move' && entry.move.name === MoveName.Bid) {
            // A seat's second bid begins the additional-bid round. Keep the two
            // rounds separate, including in saved games without round metadata.
            if (seats.has(entry.player)) flush();
            seats.add(entry.player);
            slots.push(index);
        } else if (
            entry.type !== 'move' ||
            (entry.move.name !== MoveName.GetLoan && entry.move.name !== MoveName.PayLoan)
        ) {
            flush();
        }
    });
    flush();
    return result;
}
