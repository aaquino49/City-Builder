// Pixel Dominion — Utilities and Math Helpers

export function seededRand(seed) {
    let s = seed | 0;
    return () => {
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
    };
}

// Bind to window for legacy scripts compatibility
window.seededRand = seededRand;
