"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { CONFIG } from "../lib/config";
import { playBirthday } from "../lib/melody";
import { Burst, Fireflies, Letters } from "./Fx";

const pad = (n: number) => String(n).padStart(2, "0");

function Reveal({ children, d = 0, className = "" }: { children: ReactNode; d?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setOn(true);
        io.disconnect();
      }
    }, { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${on ? "in" : ""} ${className}`} style={{ "--d": `${d}s` } as CSSProperties}>
      {children}
    </div>
  );
}

function Photo() {
  const [ok, setOk] = useState(true);
  return (
    <div className="polaroid">
      <div className="ph">
        {ok ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={CONFIG.photo} alt={CONFIG.name} onError={() => setOk(false)} />
        ) : (
          <span className="ph-miss">
            Put your favorite photo of {CONFIG.name} at <b>public/guest.png</b>
          </span>
        )}
      </div>
      <div className="cap">{CONFIG.caption}</div>
    </div>
  );
}

function Snap({ src, caption, i }: { src: string; caption: string; i: number }) {
  const [ok, setOk] = useState(true);
  const tilt = [-5, 4, -3, 5][i % 4];
  return (
    <Reveal d={0.1 + i * 0.12} className="snap-wrap">
      <figure className="snap" style={{ "--r": `${tilt}deg` } as CSSProperties} tabIndex={0}>
        <div className="ph snap-ph">
          {ok ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={caption} loading="lazy" onError={() => setOk(false)} />
          ) : (
            <span className="ph-miss">photo</span>
          )}
        </div>
        <figcaption className="snap-cap">{caption}</figcaption>
      </figure>
    </Reveal>
  );
}

function Board() {
  return (
    <div className="board">
      <Reveal className="postit-wrap">
        <div className="postit">
          <div className="postit-title">{CONFIG.sticky.title}</div>
          <p>{CONFIG.sticky.text}</p>
          <div className="postit-sign">{CONFIG.sticky.sign}</div>
        </div>
      </Reveal>
      <div className="snaps">
        {CONFIG.snaps.map((sn, i) => (
          <Snap key={i} i={i} src={sn.src} caption={sn.caption} />
        ))}
      </div>
    </div>
  );
}

function Days() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  const diff = Math.max(0, now - new Date(CONFIG.birthDate).getTime());
  const days = Math.floor(diff / 864e5);
  const h = Math.floor(diff / 36e5) % 24;
  const m = Math.floor(diff / 6e4) % 60;
  const s = Math.floor(diff / 1e3) % 60;
  return (
    <div className="days">
      <div className="hand">the world has had you for</div>
      <div className="serif days-n">{days.toLocaleString()}</div>
      <div className="serif days-l">days</div>
      <div className="days-t">
        {pad(h)}h {pad(m)}m {pad(s)}s
      </div>
    </div>
  );
}

function Envelope({ label, msg }: { label: string; msg: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button className={`env ${open ? "open" : ""}`} onClick={() => setOpen(true)} aria-label={`Open: ${label}`}>
      <span className="env-back" />
      <span className="env-paper">{msg}</span>
      <span className="env-front" />
      <span className="env-flap" />
      <span className="env-label hand">{label}</span>
      {open && (
        <span className="env-burst">
          <Burst n={10} dist={74} />
        </span>
      )}
    </button>
  );
}

export default function Party() {
  return (
    <main className="page">
      <div className="sky" />
      <div className="grain" />
      <Fireflies count={34} />

      <header className="hero">
        <div className="hero-glow" />
        <div className="hand hero-for">a little something, just for you</div>
        <h1 className="serif hero-t">Happy birthday,</h1>
        <div className="serif hero-name">
          <Letters text={CONFIG.name} />
        </div>
        <p className="hand hero-sub">I thought of you.</p>
        <button className="ghost" onClick={() => playBirthday(CONFIG.song)}>
          ♪ play a little song
        </button>
        <div className="scroll">
          <span>scroll</span>
          <i />
        </div>
      </header>

      <div className="wrap">
        <section className="sec">
          <Reveal>
            <Photo />
          </Reveal>
        </section>

        <section className="sec">
          <Board />
        </section>

        <section className="sec">
          <Reveal>
            <h2 className="serif h2">Things that made me think of you</h2>
          </Reveal>
          <div className="notes">
            {CONFIG.notes.map((n, i) => (
              <Reveal key={i} className="note-row" d={0.05}>
                <p className="note">
                  <b>No. {pad(i + 1)}</b>
                  {n}
                </p>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="sec">
          <Reveal>
            <Days />
          </Reveal>
        </section>

        <section className="sec">
          <Reveal>
            <h2 className="serif h2">A few envelopes</h2>
            <p className="hand sub">tap one to open</p>
          </Reveal>
          <Reveal d={0.1}>
            <div className="envs">
              {CONFIG.envelopes.map((e, i) => (
                <Envelope key={i} label={e.label} msg={e.msg} />
              ))}
            </div>
          </Reveal>
        </section>

        <footer className="end">
          <Reveal>
            <div className="flame" />
            <h2 className="serif end-t">Happy birthday, {CONFIG.name}.</h2>
            <p className="hand end-s">I thought of you.</p>
            <p className="hand end-sig">— {CONFIG.from}</p>
          </Reveal>
        </footer>

        <p className="credit">
          created by {CONFIG.credit.by} –{" "}
          <a href={CONFIG.credit.url} target="_blank" rel="noopener noreferrer">
            {CONFIG.credit.linkText}
          </a>
        </p>
      </div>
    </main>
  );
}
