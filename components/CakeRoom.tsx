"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { CONFIG } from "../lib/config";
import { getAudioContext, playBlow, unlockAudio } from "../lib/melody";

const SENSITIVITY = 0.1; // mic loudness (0-1) that counts as blowing. Lower = more sensitive.
const BLOW_SECONDS = 0.8; // how long you need to blow
const PALETTE_HEX = [0xffb86b, 0xffd9a8, 0xf4a6b7, 0xe9a3ad, 0xfff0d6, 0xc9a6e0, 0xff9a5c];

type Mic = { level: () => number; stop: () => void };

async function startMic(): Promise<Mic> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  const ctx = getAudioContext();
  const src = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser(); // not connected to speakers, so no feedback
  analyser.fftSize = 512;
  src.connect(analyser);
  const buf = new Uint8Array(analyser.fftSize);
  return {
    level() {
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const x = (buf[i] - 128) / 128;
        sum += x * x;
      }
      return Math.sqrt(sum / buf.length);
    },
    stop() {
      stream.getTracks().forEach((t) => t.stop());
      src.disconnect();
    },
  };
}

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat?: [number, number]) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

export default function CakeRoom({ onBlown }: { onBlown: () => void }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const meterRef = useRef<HTMLDivElement>(null);
  const holdRef = useRef(false);
  const goRef = useRef(false); // true after "Make a wish" is tapped
  const micRef = useRef<Mic | null>(null);
  const blownRef = useRef(onBlown);
  useEffect(() => {
    blownRef.current = onBlown;
  });

  const total = Math.min(Math.max(CONFIG.candles, 1), 12);
  const [started, setStarted] = useState(false);
  const [overlayGone, setOverlayGone] = useState(false);
  const [mic, setMic] = useState<"idle" | "on" | "off">("idle");

  useEffect(() => () => micRef.current?.stop(), []);
  useEffect(() => {
    if (!started) return;
    const id = setTimeout(() => setOverlayGone(true), 900);
    return () => clearTimeout(id);
  }, [started]);

  const begin = async () => {
    unlockAudio(); // must happen inside the tap
    goRef.current = true;
    setStarted(true);
    try {
      micRef.current = await startMic();
      setMic("on");
    } catch {
      setMic("off");
    }
  };

  useEffect(() => {
    const el = mountRef.current!;
    const n = total;
    let dead = false;
    const texs: THREE.Texture[] = [];

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x140a12);
    scene.fog = new THREE.Fog(0x140a12, 9, 20);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 50);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);

    // ---- lights: colourful party rig ----
    scene.add(new THREE.HemisphereLight(0xffd9b0, 0x3a1a2a, 0.45));
    const key = new THREE.DirectionalLight(0xffe0c0, 0.35);
    key.position.set(3, 6, 4);
    scene.add(key);
    const pinkL = new THREE.PointLight(0xff9a5c, 10, 14, 2);
    pinkL.position.set(-4, 3.5, 2.5);
    const aquaL = new THREE.PointLight(0xf4a6b7, 10, 14, 2);
    aquaL.position.set(4, 3.5, 2.5);
    scene.add(pinkL, aquaL);
    const spot = new THREE.SpotLight(0xffd9a8, 30, 12, 0.55, 0.8, 2);
    spot.position.set(0, 6, 1.5);
    spot.target.position.set(0, 1.6, 0);
    scene.add(spot, spot.target);

    // ---- room ----
    const wallTex = canvasTex(
      128, 128,
      (g) => {
        g.fillStyle = "#2a1624";
        g.fillRect(0, 0, 128, 128);
        g.fillStyle = "#331b2c";
        g.fillRect(0, 0, 64, 128);
      },
      [7, 1]
    );
    const floorTex = canvasTex(
      128, 128,
      (g) => {
        g.fillStyle = "#3a2218";
        g.fillRect(0, 0, 128, 128);
        g.fillStyle = "#44291c";
        g.fillRect(0, 0, 64, 64);
        g.fillRect(64, 64, 64, 64);
      },
      [7, 7]
    );
    texs.push(wallTex, floorTex);
    const room = new THREE.Mesh(
      new THREE.BoxGeometry(14, 7, 14),
      new THREE.MeshStandardMaterial({ map: wallTex, side: THREE.BackSide, roughness: 1 })
    );
    room.position.y = 3.5;
    scene.add(room);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.7 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.01;
    scene.add(floor);

    // ---- banner (redrawn once the script font has loaded) ----
    const text = `Happy birthday, ${CONFIG.name}`;
    const bannerCv = document.createElement("canvas");
    bannerCv.width = 1024;
    bannerCv.height = 256;
    const bannerTex = new THREE.CanvasTexture(bannerCv);
    bannerTex.colorSpace = THREE.SRGBColorSpace;
    texs.push(bannerTex);
    const drawBanner = () => {
      const g = bannerCv.getContext("2d")!;
      g.clearRect(0, 0, 1024, 256);
      g.shadowColor = "rgba(255,170,90,.9)";
      g.shadowBlur = 28;
      g.fillStyle = "#ffe2bd";
      g.textAlign = "center";
      g.textBaseline = "middle";
      let px = 100;
      do {
        g.font = `700 ${px}px "Caveat Variable", cursive`;
        px -= 4;
      } while (g.measureText(text).width > 940 && px > 30);
      g.fillText(text, 512, 140);
      bannerTex.needsUpdate = true;
    };
    drawBanner();
    document.fonts
      .load('700 100px "Caveat Variable"')
      .then(() => {
        if (!dead) drawBanner();
      })
      .catch(() => {});
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), new THREE.MeshBasicMaterial({ map: bannerTex, transparent: true }));
    banner.position.set(0, 3.9, -6.9);
    scene.add(banner);

    // ---- bunting ----
    const flagGeo = new THREE.SphereGeometry(0.075, 12, 12);
    const flagMats = [0xffd9a8, 0xffb86b, 0xf4a6b7, 0xfff0d6].map((c) => new THREE.MeshBasicMaterial({ color: c }));
    const flags: THREE.Mesh[] = [];
    const bunting = (a: THREE.Vector3, b: THREE.Vector3, sag: number, count: number, rotY: number) => {
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= count; k++) {
        const t = k / count;
        const p = a.clone().lerp(b, t);
        p.y -= sag * 4 * t * (1 - t);
        pts.push(p);
      }
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x7a5a48 })));
      for (let k = 0; k < count; k++) {
        const f = new THREE.Mesh(flagGeo, flagMats[k % flagMats.length]);
        f.position.copy(pts[k].clone().lerp(pts[k + 1], 0.5));
        f.rotation.y = rotY;
        f.userData.phase = k * 0.7;
        scene.add(f);
        flags.push(f);
      }
    };
    bunting(new THREE.Vector3(-6.8, 5.7, -6.8), new THREE.Vector3(6.8, 5.7, -6.8), 0.9, 16, 0);
    bunting(new THREE.Vector3(-6.8, 5.7, -6.8), new THREE.Vector3(-6.8, 5.7, 5), 0.9, 14, Math.PI / 2);
    bunting(new THREE.Vector3(6.8, 5.7, -6.8), new THREE.Vector3(6.8, 5.7, 5), 0.9, 14, Math.PI / 2);

    // ---- table, plate ----
    const std = (color: number, roughness = 0.6) => new THREE.MeshStandardMaterial({ color, roughness });
    const add = (geo: THREE.BufferGeometry, color: number, y: number, parent: THREE.Object3D = scene) => {
      const m = new THREE.Mesh(geo, std(color));
      m.position.y = y;
      parent.add(m);
      return m;
    };
    add(new THREE.CylinderGeometry(0.3, 0.4, 0.7, 24), 0x3b2a2a, 0.35);
    add(new THREE.CylinderGeometry(2.2, 2.2, 0.12, 48), 0x6e4328, 0.74);
    add(new THREE.CylinderGeometry(1.5, 1.5, 0.04, 48), 0xf4e8d8, 0.82);

    // ---- cake (slowly turning) ----
    const cake = new THREE.Group();
    scene.add(cake);
    add(new THREE.CylinderGeometry(1.2, 1.2, 0.55, 48), 0xe9a3ad, 1.115, cake);
    add(new THREE.CylinderGeometry(0.85, 0.85, 0.5, 48), 0xfff1e2, 1.64, cake);
    for (const [r, y] of [[1.2, 1.39], [0.85, 1.89]]) {
      const ring = add(new THREE.TorusGeometry(r, 0.07, 12, 48), 0xffffff, y, cake);
      ring.rotation.x = Math.PI / 2;
    }
    const sprGeo = new THREE.BoxGeometry(0.03, 0.03, 0.12);
    const sprMats = PALETTE_HEX.map((c) => std(c));
    for (let i = 0; i < 46; i++) {
      const onTop = i < 26;
      const ang = Math.random() * Math.PI * 2;
      const rad = onTop ? 0.12 + Math.random() * 0.65 : 0.92 + Math.random() * 0.22;
      const s = new THREE.Mesh(sprGeo, sprMats[i % sprMats.length]);
      s.position.set(Math.cos(ang) * rad, onTop ? 1.9 : 1.405, Math.sin(ang) * rad);
      s.rotation.y = Math.random() * Math.PI;
      cake.add(s);
    }

    // ---- candles: already lit ----
    const flameGeo = new THREE.SphereGeometry(0.06, 12, 12);
    flameGeo.scale(1, 1.8, 1);
    const flames: THREE.Group[] = [];
    const lights: THREE.PointLight[] = [];
    const state = Array.from({ length: n }, () => ({ lit: true, s: 0, outAt: 0, seed: Math.random() * 10 }));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = n === 1 ? 0 : 0.55;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;

      const candle = add(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 12), PALETTE_HEX[i % 7], 2.09, cake);
      candle.position.x = x;
      candle.position.z = z;

      const flame = new THREE.Group();
      flame.add(new THREE.Mesh(flameGeo, new THREE.MeshBasicMaterial({ color: 0xffa31a })));
      const inner = new THREE.Mesh(flameGeo, new THREE.MeshBasicMaterial({ color: 0xfff2a8 }));
      inner.scale.set(0.55, 0.6, 0.55);
      flame.add(inner);
      flame.position.set(x, 2.4, z);
      flame.scale.setScalar(0);
      cake.add(flame);
      flames.push(flame);

      const light = new THREE.PointLight(0xffa64d, 0, 7, 2);
      light.position.set(x, 2.6, z);
      cake.add(light);
      lights.push(light);
    }

    // ---- balloons ----
    const balloons = ([] as number[]).map((x, i) => {
      const gr = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: PALETTE_HEX[i % 7], roughness: 0.25, emissive: PALETTE_HEX[i % 7], emissiveIntensity: 0.15 });
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 24), mat);
      body.scale.y = 1.2;
      gr.add(body);
      const knot = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 8), mat);
      knot.position.y = -0.55;
      knot.rotation.x = Math.PI;
      gr.add(knot);
      const str = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 2, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      str.position.y = -1.6;
      gr.add(str);
      gr.position.set(x, 2.4 + (i % 2) * 0.6, -5.2 + (i % 3) * 0.6);
      gr.userData.baseY = gr.position.y;
      scene.add(gr);
      return gr;
    });

    // ---- sparkles ----
    const dotTex = canvasTex(64, 64, (g) => {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, "rgba(255,255,255,1)");
      gr.addColorStop(0.4, "rgba(255,255,255,.5)");
      gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
    });
    texs.push(dotTex);
    const NS = 140;
    const sp = new Float32Array(NS * 3);
    const sc = new Float32Array(NS * 3);
    const sv = new Float32Array(NS);
    const sph = new Float32Array(NS);
    const col = new THREE.Color();
    for (let i = 0; i < NS; i++) {
      sp[i * 3] = (Math.random() - 0.5) * 8;
      sp[i * 3 + 1] = 0.5 + Math.random() * 5;
      sp[i * 3 + 2] = (Math.random() - 0.5) * 6;
      col.setHex(PALETTE_HEX[i % 7]);
      sc[i * 3] = col.r;
      sc[i * 3 + 1] = col.g;
      sc[i * 3 + 2] = col.b;
      sv[i] = 0.15 + Math.random() * 0.35;
      sph[i] = Math.random() * 6.28;
    }
    const sGeo = new THREE.BufferGeometry();
    sGeo.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    sGeo.setAttribute("color", new THREE.BufferAttribute(sc, 3));
    const sparkles = new THREE.Points(
      sGeo,
      new THREE.PointsMaterial({ size: 0.16, map: dotTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 })
    );
    sparkles.frustumCulled = false;
    scene.add(sparkles);

    // ---- sizing ----
    let zNear = 5.4;
    let zFar = 8.6;
    const resize = () => {
      const w = el.clientWidth || 1;
      const h = el.clientHeight || 1;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      const portrait = w / h < 1;
      zNear = portrait ? 8 : 5.4;
      zFar = portrait ? 12.5 : 8.6;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    // ---- loop ----
    const clock = new THREE.Clock();
    let raf = 0;
    let blowT = 0;
    let done = false;
    let introP = 0;
    let boost = 1;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;

      // camera: slow drift before the tap, then dolly in toward the cake
      if (goRef.current) introP = Math.min(1, introP + dt / 2.4);
      const e = 1 - Math.pow(1 - introP, 3);
      const orbit = (1 - e) * 1.4 + 0.6;
      camera.position.set(Math.sin(t * 0.3) * orbit, 3.6 - 0.9 * e, zFar + (zNear - zFar) * e);
      camera.lookAt(0, 1.5 + (1 - e) * 0.6, 0);

      // blowing
      const blowing = goRef.current && (holdRef.current || (micRef.current?.level() ?? 0) > SENSITIVITY);
      blowT = blowing ? blowT + dt : Math.max(0, blowT - dt * 0.6);
      const lean = Math.min(blowT / BLOW_SECONDS, 1);
      if (meterRef.current) meterRef.current.style.transform = `scaleX(${lean})`;

      if (!done && blowT > BLOW_SECONDS) {
        done = true;
        playBlow(n);
        boost = 5;
        state.forEach((c, i) => (c.outAt = t + i * 0.1));
        setTimeout(() => {
          if (!dead) blownRef.current();
        }, 700 + n * 100);
      }

      state.forEach((c, i) => {
        if (done && c.lit && t >= c.outAt) c.lit = false;
        c.s += ((c.lit ? 1 : 0) - c.s) * Math.min(1, dt * (c.lit ? 6 : 8));
        const f = c.s * (1 + 0.12 * Math.sin(t * 18 + c.seed)) * (1 - lean * 0.35);
        flames[i].visible = c.s > 0.02;
        flames[i].scale.set(f, f, f);
        flames[i].rotation.z = lean * 0.7 * Math.sin(t * 30 + c.seed);
        lights[i].intensity = 7 * c.s * (0.85 + 0.15 * Math.sin(t * 23 + c.seed));
      });

      cake.rotation.y = t * 0.25;
      balloons.forEach((b, i) => {
        b.position.y = b.userData.baseY + Math.sin(t * 0.8 + i) * 0.14;
        b.rotation.z = Math.sin(t * 0.6 + i) * 0.05;
      });
      flags.forEach((f) => {
        f.scale.setScalar(0.85 + 0.25 * Math.sin(t * 2 + f.userData.phase));
      });
      pinkL.intensity = 10 + Math.sin(t * 1.3) * 2;
      aquaL.intensity = 10 + Math.cos(t * 1.1) * 2;

      boost = 1 + (boost - 1) * Math.exp(-dt * 1.5);
      for (let i = 0; i < NS; i++) {
        sp[i * 3 + 1] += sv[i] * dt * boost;
        sp[i * 3] += Math.sin(t + sph[i]) * 0.003;
        if (sp[i * 3 + 1] > 5.8) {
          sp[i * 3 + 1] = 0.5;
          sp[i * 3] = (Math.random() - 0.5) * 8;
          sp[i * 3 + 2] = (Math.random() - 0.5) * 6;
        }
      }
      sGeo.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
    };
    tick();

    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Points || o instanceof THREE.Line) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
        }
      });
      texs.forEach((t) => t.dispose());
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, [total]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#140a12", touchAction: "none" }}>
      <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />

      {!overlayGone && (
        <div className="intro" style={{ opacity: started ? 0 : 1, pointerEvents: started ? "none" : "auto" }}>
                    <div className="intro-inner">
            <div className="chip">for {CONFIG.name}</div>
            <h1 className="serif big-title">I thought of you</h1>
            <p>Someone lit a few candles for you. Make a wish, then blow them out.</p>
            <button className="btn pulse" onClick={begin}>
              Make a wish
            </button>
            <small>Allow the mic to blow for real, or use the blow button.</small>
          </div>
        </div>
      )}

      {started && (
        <div className="hud">
          <div className="hand wish">Make a wish</div>
          <div className="hud-bottom">
            <p className="hint">{mic === "on" ? "Take a deep breath and blow into your mic" : "Hold the button to blow"}</p>
            <div className="meter">
              <div ref={meterRef} className="meter-fill" style={{ transform: "scaleX(0)" }} />
            </div>
            <button
              className="btn btn-hold"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                holdRef.current = true;
              }}
              onPointerUp={() => (holdRef.current = false)}
              onPointerCancel={() => (holdRef.current = false)}
              onContextMenu={(e) => e.preventDefault()}
            >
              Hold to blow
            </button>
            {mic === "off" && <small style={{ opacity: 0.75 }}>Mic unavailable (needs permission and https). Use the button.</small>}
          </div>
        </div>
      )}
    </div>
  );
}
