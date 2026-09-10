type Note = [number, number, number, number, number?, number?];
type Cue = { label: string; notes: Note[] };
export const soundCues: Record<string, Cue> = {
    sail: {
        label: 'Ship sailing',
        notes: [
            [0, 1.4, 0, 0.13, 650, 0.32],
            [0.5, 1.4, 0, 0.09, 800, 0.38],
            [0.08, 1.55, 105, 0.035, 82, 0.3],
        ],
    },
    produce: {
        label: 'Container production',
        notes: [
            [0, 0.12, 0, 0.13, 1400],
            [0.13, 0.12, 0, 0.1, 1200],
            [0.25, 0.16, 140, 0.09, 75],
        ],
    },
    build: {
        label: 'Factory / warehouse',
        notes: [
            [0, 0.1, 0, 0.16, 1100],
            [0.1, 0.22, 105, 0.11, 50],
        ],
    },
    trade: {
        label: 'Cargo sale / purchase',
        notes: [
            [0, 0.12, 700, 0.07],
            [0.1, 0.16, 1050, 0.06],
        ],
    },
    bid: { label: 'Auction bid', notes: [[0, 0.12, 350, 0.08, 500]] },
    loan: {
        label: 'Loan / repayment',
        notes: [
            [0, 0.14, 700, 0.06, 400],
            [0.13, 0.15, 400, 0.05],
        ],
    },
};
let context: AudioContext | undefined;
let enabled = true;
export function setSoundEnabled(value: boolean): void {
    enabled = value;
}
export function playSound(name: string): void {
    if (!enabled || !soundCues[name] || typeof window === 'undefined') {
        return;
    }
    if (typeof navigator !== 'undefined') {
        const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
        if (activation && !activation.hasBeenActive) {
            return;
        }
    }
    const Audio = window.AudioContext;
    if (!Audio) {
        return;
    }
    context = context || new Audio();
    const ctx = context;
    void ctx
        .resume()
        .then(() => {
            if (!enabled || ctx.state !== 'running') {
                return;
            }
            for (const [offset, duration, frequency, volume, endFrequency, attack] of soundCues[name].notes) {
                const start = ctx.currentTime + offset;
                const gain = ctx.createGain();
                gain.gain.setValueAtTime(0.0001, start);
                gain.gain.exponentialRampToValueAtTime(volume, start + (attack || 0.008));
                gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
                gain.connect(ctx.destination);
                if (frequency === 0) {
                    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
                    const samples = buffer.getChannelData(0);
                    let wash = 0;
                    for (let i = 0; i < samples.length; i++) {
                        const noise = Math.random() * 2 - 1;
                        wash = wash * 0.97 + noise * 0.03;
                        samples[i] = attack ? wash * 3 * (0.75 + 0.25 * Math.sin((i / ctx.sampleRate) * 13)) : noise;
                    }
                    const source = ctx.createBufferSource();
                    source.buffer = buffer;
                    const filter = ctx.createBiquadFilter();
                    filter.type = 'lowpass';
                    filter.frequency.value = endFrequency || 900;
                    if (attack) {
                        filter.frequency.setValueAtTime(350, start);
                        filter.frequency.exponentialRampToValueAtTime(endFrequency || 900, start + attack);
                        filter.frequency.exponentialRampToValueAtTime(280, start + duration);
                    }
                    source.connect(filter);
                    filter.connect(gain);
                    source.start(start);
                    source.stop(start + duration);
                } else {
                    const oscillator = ctx.createOscillator();
                    oscillator.type = 'sine';
                    oscillator.frequency.setValueAtTime(frequency, start);
                    oscillator.frequency.exponentialRampToValueAtTime(endFrequency || frequency, start + duration);
                    oscillator.connect(gain);
                    oscillator.start(start);
                    oscillator.stop(start + duration);
                }
            }
        })
        .catch(() => undefined);
}

export function installActionSounds(emitter: { on: (event: string, fn: (value: any) => void) => unknown }): void {
    let previous: string[] | undefined;
    let replaying = false;
    emitter.on('update:preference', (pref) => {
        if (pref?.name === 'sound') {
            setSoundEnabled(pref.value);
        }
    });
    emitter.on('preferences', (prefs) => {
        if (typeof prefs?.sound === 'boolean') {
            setSoundEnabled(prefs.sound);
        }
    });
    emitter.on('replay:start', () => {
        replaying = true;
    });
    emitter.on('replay:end', () => {
        replaying = false;
        previous = undefined;
    });
    const receiveState = (state: any) => {
        const entries = state?.log || [];
        const next = entries.map((entry: any) => JSON.stringify(entry));
        const extendsHistory =
            previous && previous.length < next.length && previous.every((entry, i) => entry === next[i]);
        const from = previous?.length || 0;
        previous = next;
        if (!extendsHistory || replaying) {
            return;
        }
        const cues = entries
            .slice(from)
            .map((entry: any) => cueForEntry(entry))
            .filter(Boolean);
        // Reconnection can deliver a whole round: play only the most recent event.
        const cue = cues[cues.length - 1];
        if (cue) {
            playSound(cue);
        }
    };
    emitter.on('state', receiveState);
    emitter.on('gamelog', (event) => {
        if (event?.data?.state) {
            receiveState(event.data.state);
        }
    });
}

export function mountSoundTests(emitter: { emit: (event: string, value: any) => unknown }): void {
    const panel = document.createElement('details');
    panel.style.cssText =
        'position:relative;z-index:5;padding:10px 16px;margin:8px;background:#172638;color:#f0f4f8;border:1px solid #56718a;border-radius:8px;font:14px system-ui';
    const summary = document.createElement('summary');
    summary.textContent = 'Playtest tools · sounds';
    panel.append(summary);
    const label = document.createElement('label');
    label.style.margin = '10px';
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.checked = true;
    toggle.onchange = () => {
        setSoundEnabled(toggle.checked);
        emitter.emit('preferences', { sound: toggle.checked });
    };
    label.append(toggle, ' Game sounds');
    panel.append(label);
    for (const [name, cue] of Object.entries(soundCues)) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = cue.label;
        button.style.cssText =
            'margin:8px 4px;padding:7px 12px;color:#f0f4f8;background:#294663;border:1px solid #7391ad;border-radius:5px;cursor:pointer';
        button.onclick = () => playSound(name);
        panel.append(button);
    }
    document.body.prepend(panel);
}
function cueForEntry(entry: any): string | undefined {
    return (
        {
            sail: 'sail',
            produce: 'produce',
            buyFactory: 'build',
            buyWarehouse: 'build',
            domesticSale: 'trade',
            buyFromFactory: 'trade',
            buyFromWarehouse: 'trade',
            accept: 'trade',
            bid: 'bid',
            getLoan: 'loan',
            payLoan: 'loan',
        } as Record<string, string>
    )[entry.move?.name];
}
