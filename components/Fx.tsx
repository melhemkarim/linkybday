import type { CSSProperties } from "react";

export const PALETTE = ["#ffb86b", "#ffd9a8", "#f4a6b7", "#e9a3ad", "#fff0d6", "#c9a6e0"];

// Deterministic (no Math.random) so server and client render the same markup.
export function Fireflies({ count = 34 }: { count?: number }) {
  return (
    <div aria-hidden className="fireflies">
      {Array.from({ length: count }, (_, i) => (
        <i
          key={i}
          className="fly"
          style={{
            left: `${(i * 37 + 11) % 100}%`,
            top: `${(i * 61 + 7) % 100}%`,
            width: 2 + ((i * 3) % 4),
            height: 2 + ((i * 3) % 4),
            color: PALETTE[i % PALETTE.length],
            "--dur": `${7 + ((i * 5) % 9)}s`,
            "--del": `-${(i * 3) % 10}s`,
            "--dx": `${((i * 17) % 50) - 25}px`,
          } as CSSProperties}
        />
      ))}
    </div>
  );
}

export function Letters({ text }: { text: string }) {
  return (
    <>
      {Array.from(text).map((ch, i) => (
        <span key={i} className="letter" style={{ "--i": i } as CSSProperties}>
          {ch}
        </span>
      ))}
    </>
  );
}

// Ring of soft dots that fly outwards. Place inside a position:absolute parent.
export function Burst({ n = 10, dist = 56 }: { n?: number; dist?: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="spark" style={{ "--a": `${(360 / n) * i}deg`, "--dist": `${dist}px`, background: PALETTE[i % PALETTE.length] } as CSSProperties} />
      ))}
    </>
  );
}
