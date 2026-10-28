import * as THREE from "three";
import gsap from "gsap";
import { loadCards } from "./cards.js";
import { cardVert, cardFrag, lensVert, lensFrag } from "./shader.js";
import { buildPanel } from "./panel.js";

// ---- every tunable; the side panel edits these live ----
export const DEFAULTS = {
  vertical: 1,          // 1 = scroll top to bottom, 0 = left to right
  // layout ("along" = scroll axis, "across" = the other one)
  cardAspect: 1.8,      // card width / height (images are cover-cropped to it)
  cardSize: 0.25,       // centre card length along, fraction of the viewport
  cardMaxAcross: 0.62,  // cap across, fraction of the viewport (keeps phones sane)
  stack: 0,             // 1 = cards edge to edge like the original, 0 = spaced out with peeking neighbours
  gap: 111,              // px between cards when stacked
  peek: 0.07,           // (spaced mode) how much of the next / previous card shows
  sideScale: 1,         // neighbour size relative to the centre card
  farPush: 1,
  radius: 0.03,         // corner radius, fraction of card height
  edgeLight: 0,
  // portal shape — the original lens, in the original's frame (see shader s2o)
  shape: 0,             // 0 ellipse, 1 rounded rect
  round: 0.4,
  sizeX: 0.575,         // half size, original height units
  sizeY: 1.385,
  rotation: 49,         // degrees
  posX: 0.5,
  posY: 0.5,
  oAspect: 1.92,        // the original screen's aspect: sets where the rim lands along the stack
  cardCross: 0.47,      // the original card's height in its own units: sets the rim across
  // refraction (original values)
  zoom: 0,
  dispersion: 11,
  blur: 0,
  rimStart: 0.46,       // where the bend starts building (lower = longer, smoother arc)
  rimEase: 1.3,         // >1 = gentler onset
  rimRelease: 0.82,     // the warp eases back to zero from here to the rim: seamless, no ghost copies
  outside: 1,           // 1 = cards visible outside the portal too (intact), 0 = only through the glass
  rimTangential: 0.6,   // how hard images get dragged along the rim (the bulge)
  rimInward: 0,
  rimFreq1: 2,
  rimFreq2: 1,
  waveSpeed: 0,         // 0 = rim holds still, like the original
  mirror: 0,            // 0 = like the original, 1 = top warp copied to bottom, 2 = bottom to top
  glowOnBg: 0,          // 0 = glass only visible on images
  stick: 1,             // 1 = warp fades out away from cards (keeps the peeking layout clean), 0 = original
  stickPx: 260,         // how far a bulge can swell past a card before it fades, px
  // glow
  glow: 4.2,
  whiteGlow: 0.24,
  novaSize: 12,
  centerDark: 0.09,
  blueRing: 6,
  ringRadius: 0.49,
  ringWidth: 0.014,
  shimmerFreq: 12,
  shimmerSpeed: 3.5,
  shimmerDepth: 0.12,
  blueColor: "#009dff",
  rimLine: 1.4,
  rimLinePos: 0.488,
  rimLineWidth: 0.003,
  vignette: 0,
  vignetteSize: 0.3,
  // entry
  entry: 1,
  entryStartPx: 80,     // card size when it rises in
  riseDuration: 1,
  riseStagger: 0.08,
  fromBelow: 0.9,       // start offset, fraction of the viewport
  growDelay: 0.25,
  growDuration: 2.15,
  growStagger: 0.085,
  lensBloom: 1.4,
  // feel — how cards arrive and leave
  motionStyle: 1,       // 1 = spring (eases in and out), 0 = the original's single lerp
  springStiffness: 55,  // higher = quicker trip between cards
  springDamping: 0.95,  // 1 = no overshoot, lower = a soft overshoot as it lands
  bend: 0.5,            // cards bow while moving (px of bow per px/frame of speed)
  bendMax: 30,          // cap on the bow, px (small: cards sit close together)
  parallax: 0.12,       // photo drifts inside its frame as the card travels
  warpBoost: 0.8,       // extra rim swirl while moving
  dispBoost: 1.2,       // extra colour split while moving
  // motion — the original's scroll model: one lerp toward a target, snap when idle
  ease: 0.09,           // glide weight (lower = heavier)
  snapEase: 0.05,       // softer landing once it snaps to a card
  snapIdleMs: 120,      // idle time before it snaps
  pageAt: 0.08,         // a gesture past this much of a card pages to the next one
  touchEase: 0.22,      // finger drags follow harder
  wheel: 1.4,           // px of travel per wheel px
  drag: 1.6,
  friction: 0.865,      // flick momentum decay
  shrink: 0.25,         // cards compress up to this much at speed
  shrinkMax: 60,        // px/frame that counts as full speed
  shrinkAttack: 0.25,
  shrinkDecay: 0.06,
  motionBlur: 0.12,     // keep it light: the warp should read liquid, not smudged
  autoplay: 0,
  // scene
  bg: "#ffffff",
};

const STORE = "portal-carousel-v21";
let saved = {};
try { saved = JSON.parse(localStorage.getItem(STORE) || "{}"); } catch { saved = {}; }
export const P = { ...DEFAULTS };
for (const k in saved) if (k in DEFAULTS) P[k] = saved[k];
export function persist() {
  try { localStorage.setItem(STORE, JSON.stringify(P)); } catch { /* storage off */ }
}

// ---- renderer ----
const stage = document.getElementById("stage");
const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
const dpr = Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(dpr);
stage.appendChild(renderer.domElement);
const canvas = renderer.domElement;

// pass 1: flat stack, ortho camera where 1 unit = 1 css px
const rowScene = new THREE.Scene();
const rowCam = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
const fbo = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
// tiny copy of the card shapes: upscaled bilinearly it's a cheap blur for the soft stick mask
const covRT = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });

const sources = loadCards(renderer);
const N = sources.length;
const plane = new THREE.PlaneGeometry(1, 1, 24, 24);    // subdivided so cards can bow
const cards = sources.map((src) => {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: src.tex }, uSize: { value: new THREE.Vector2(1, 1) },
      uRadius: { value: 0 }, uEdgeLight: { value: 0 }, uFade: { value: 1 },
      uTexAspect: { value: 1 }, uReady: { value: 0 },
      uBend: { value: 0 }, uVert: { value: 1 }, uT: { value: 0 }, uParallax: { value: 0 },
    },
    vertexShader: cardVert, fragmentShader: cardFrag,
    transparent: true, depthTest: false, depthWrite: false,
  });
  const mesh = new THREE.Mesh(plane, mat);
  rowScene.add(mesh);
  return { mesh, u: mat.uniforms, src };
});

// pass 2: the glass portal
const LENS_MAP = {
  uSizeX: "sizeX", uSizeY: "sizeY", uShape: "shape", uRound: "round",
  uZoom: "zoom", uDispersion: "dispersion", uBlur: "blur",
  uRimStart: "rimStart", uRimEase: "rimEase", uOutside: "outside", uRimRelease: "rimRelease", uRimTangential: "rimTangential", uRimInward: "rimInward",
  uRimFreq1: "rimFreq1", uRimFreq2: "rimFreq2", uWaveSpeed: "waveSpeed", uGlowOnBg: "glowOnBg",
  uStick: "stick", uMirror: "mirror",
  uGlow: "glow", uWhiteGlow: "whiteGlow", uNovaSize: "novaSize", uCenterDark: "centerDark",
  uBlueRing: "blueRing", uRingRadius: "ringRadius", uRingWidth: "ringWidth",
  uShimmerFreq: "shimmerFreq", uShimmerSpeed: "shimmerSpeed", uShimmerDepth: "shimmerDepth",
  uRimLine: "rimLine", uRimLinePos: "rimLinePos", uRimLineWidth: "rimLineWidth",
  uVignette: "vignette", uVignetteSize: "vignetteSize",
};
const lensU = {
  tScene: { value: fbo.texture }, uRes: { value: new THREE.Vector2() },
  uAspect: { value: 1 }, uTime: { value: 0 }, uFx: { value: 0 }, uMB: { value: 0 },
  uEnergy: { value: 0 }, uWarpBoost: { value: 0 }, uDispBoost: { value: 0 },
  uVertical: { value: 1 }, uCenter: { value: new THREE.Vector2(0.5, 0.5) },
  uRotation: { value: 0 }, uBlueColor: { value: new THREE.Color() }, uBg: { value: new THREE.Color() },
  uStickPx: { value: 28 }, tCover: { value: covRT.texture },
  uAlongPx: { value: 1 }, uCrossPx: { value: 1 }, uCardCross: { value: 0.47 }, uOAspect: { value: 1.92 },
};
for (const k in LENS_MAP) lensU[k] = { value: 0 };
const lensScene = new THREE.Scene();
const lensCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const lensMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(2, 2),
  new THREE.ShaderMaterial({ uniforms: lensU, vertexShader: lensVert, fragmentShader: lensFrag, depthTest: false, depthWrite: false }),
);
lensMesh.frustumCulled = false;
lensScene.add(lensMesh);

// ---- layout ----
let W = 1, H = 1;
function resize() {
  W = stage.clientWidth || innerWidth;
  H = stage.clientHeight || innerHeight;
  renderer.setSize(W, H, false);
  fbo.setSize(Math.round(W * dpr), Math.round(H * dpr));  // device px, or it goes soft
  Object.assign(rowCam, { left: -W / 2, right: W / 2, top: H / 2, bottom: -H / 2 });
  rowCam.updateProjectionMatrix();
  lensU.uRes.value.set(W * dpr, H * dpr);
  lensU.uAspect.value = W / H;
}
new ResizeObserver(resize).observe(stage);
resize();

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / Math.max(1e-4, b - a))); return t * t * (3 - 2 * t); };
const wrap = (x) => ((x % N) + N) % N;
const isV = () => P.vertical > 0.5;

// ---- plain numbers that GSAP animates; the frame loop turns them into transforms ----
const rise = new Array(N).fill(1);    // 0 = below the screen .. 1 = in place
const grow = new Array(N).fill(1);    // 0 = entry size .. 1 = full size
const S = { fx: 1, entryActive: false };

function cardSizeFull() {
  const V = isV();
  const L = V ? H : W, C = V ? W : H;
  // length along the scroll axis, capped across
  let along = L * P.cardSize;
  let across = V ? along * P.cardAspect : along / P.cardAspect;
  if (across > C * P.cardMaxAcross) { along *= (C * P.cardMaxAcross) / across; across = C * P.cardMaxAcross; }
  return V ? { w: across, h: along, along } : { w: along, h: across, along };
}

// stacked: cards edge to edge with a small gap (the original).
// spaced: neighbours placed so exactly `peek` of them pokes in from the screen edge.
function neighbourDistance(full) {
  const L = isV() ? H : W;
  const half = (full.along * P.sideScale) / 2;
  if (P.stack > 0.5) return full.along / 2 + half + P.gap;
  const peeking = L / 2 - P.peek * L + half;
  return Math.max(peeking, full.along / 2 + half + 16);
}

function place(i, t, full, spacing, shrinkK, bendPx) {
  const c = cards[i], V = isV();
  const at = Math.abs(t), s = Math.sign(t);
  // speed shrink (from the original): everything compresses a little while moving
  const scale = (1 - (1 - P.sideScale) * Math.min(at, 1)) * shrinkK;
  spacing *= shrinkK;
  // during the entry cards start tiny and packed, then spread as they grow
  const g = grow[i];
  const startK = Math.min(1, P.entryStartPx / full.h);
  const k = startK + (1 - startK) * g;
  const packed = startK + (1 - startK) * Math.max(...grow);  // follow the biggest card so none overlap
  const d0 = at <= 1 ? t * spacing : s * (spacing + (at - 1) * spacing * P.farPush);
  const d = d0 * packed;
  const w = full.w * scale * k, h = full.h * scale * k;
  const L = V ? H : W;
  const riseOff = (1 - rise[i]) * P.fromBelow * L;      // comes in from below / the right
  if (V) c.mesh.position.set(0, -d - riseOff, 0);
  else c.mesh.position.set(d + riseOff, 0, 0);
  c.mesh.scale.set(w, h, 1);
  c.u.uSize.value.set(w, h);
  c.u.uRadius.value = P.radius * h;
  c.u.uEdgeLight.value = P.edgeLight;
  c.u.uTexAspect.value = c.src.aspect;
  c.u.uReady.value = c.src.ready ? 1 : 0;
  c.u.uBend.value = bendPx;
  c.u.uVert.value = V ? 1 : 0;
  c.u.uT.value = t;
  c.u.uParallax.value = P.parallax;
  c.u.uFade.value = 1 - smooth(1.6, 2.4, at);
  c.mesh.visible = c.u.uFade.value > 0.001;
  c.mesh.renderOrder = -Math.round(at * 100);
}

// ---- motion: the original's model. `cur` (in cards) lerps toward `target`.
// wheel / drag / flick only ever move `target`; after SNAP_IDLE_MS of no input the
// target is redirected to the nearest card and the glide switches to the softer ease.
let cur = 0, target = 0, velocity = 0, energy = 0;
let cv = 0;                                              // spring velocity, cards / second
let vSm = 0;                                             // smoothed signed speed, px / frame
let dragging = false, touch = false, snapped = true, journey = false, lastInput = 0;
let home = 0;                                            // card we last settled on
let last = performance.now(), autoT = 0;
const pos = parseFloat(new URLSearchParams(location.search).get("pos"));
if (Number.isFinite(pos)) cur = target = home = pos;     // ?pos=0.5 holds between cards
const bgCol = new THREE.Color();
const hint = document.querySelector(".hint");
const lerpK = (k, f) => 1 - Math.pow(1 - k, f);       // per-frame ease, frame-rate independent
const spacingPx = () => neighbourDistance(cardSizeFull());

function frame(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
  last = now;
  const f = dt * 60;                                     // "frames" at 60fps

  if (P.autoplay > 0 && !dragging && !S.entryActive && now - lastInput > 1500) {
    autoT += dt;
    if (autoT >= P.autoplay) { autoT = 0; goTo(Math.round(target) + 1); }
  } else autoT = 0;

  if (!dragging) {
    target += velocity * f;                              // flick momentum
    velocity *= Math.pow(P.friction, f);
    if (Math.abs(velocity) < 1e-4) velocity = 0;
    if (!snapped && !velocity && now - lastInput > P.snapIdleMs && !Number.isFinite(pos)) {
      // settle: a small push still pages to the next card in that direction,
      // a bigger one lands on whatever is nearest
      const d = target - home;
      if (Math.abs(d) >= P.pageAt && Math.abs(d) < 1) target = home + Math.sign(d);
      else target = Math.round(Math.abs(d) < P.pageAt ? home : target);
      home = target;
      snapped = true;
      journey = true;                                    // glide there with the normal ease
    }
  }
  const prev = cur;
  if (dragging || P.motionStyle < 0.5) {
    // the original's single lerp (and always while a finger / mouse holds the row)
    const follow = dragging && touch ? P.touchEase : snapped && !journey ? P.snapEase : P.ease;
    cur += (target - cur) * lerpK(follow, f);
    cv = (cur - prev) / dt;                              // keep the spring in sync for the hand-off
  } else {
    // critically damped spring: eases out of rest, builds, lands softly.
    // small substeps keep it stable at any frame rate.
    const k = P.springStiffness, c = 2 * Math.sqrt(k) * P.springDamping;
    const n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n;
    for (let s = 0; s < n; s++) { cv += (k * (target - cur) - c * cv) * h; cur += cv * h; }
  }
  if (Math.abs(target - cur) < 1e-5 && Math.abs(cv) < 1e-3) { cur = target; cv = 0; journey = false; }

  // scroll speed -> energy (fast attack, slow decay) -> shrink, glass boost
  const sp = spacingPx();
  const signed = ((cur - prev) * sp) / f;                // px per frame, + = moving to the next card
  vSm += (signed - vSm) * lerpK(0.25, f);
  const norm = Math.min(1, Math.abs(signed) / Math.max(1, P.shrinkMax));
  energy += (norm - energy) * lerpK(norm > energy ? P.shrinkAttack : P.shrinkDecay, f);
  const shrinkK = 1 - P.shrink * energy;
  const speed = energy;

  const V = isV();
  // the middle of a moving card trails its edges a little: a soft bow
  const bendPx = Math.max(-P.bendMax, Math.min(P.bendMax, (V ? -1 : 1) * P.bend * vSm));
  const full = cardSizeFull();
  for (let i = 0; i < N; i++) {
    let t = wrap(i - cur);
    if (t >= N / 2) t -= N;
    place(i, t, full, sp, shrinkK, bendPx);
  }
  hint.textContent = V ? "Drag, scroll or use ↑ ↓" : "Drag, scroll or use ← →";

  for (const key in LENS_MAP) lensU[key].value = P[LENS_MAP[key]];
  lensU.uCenter.value.set(P.posX, P.posY);
  lensU.uRotation.value = THREE.MathUtils.degToRad(P.rotation);
  lensU.uBlueColor.value.set(P.blueColor);
  lensU.uFx.value = S.fx;
  lensU.uStickPx.value = P.stickPx * dpr;
  // one coverage texel per ~quarter of the fade distance
  const texel = Math.max(4, P.stickPx / 4);
  const cw = Math.max(2, Math.ceil(W / texel)), ch = Math.max(2, Math.ceil(H / texel));
  if (covRT.width !== cw || covRT.height !== ch) covRT.setSize(cw, ch);
  lensU.uTime.value = now / 1000;
  lensU.uVertical.value = V ? 1 : 0;
  lensU.uMB.value = P.motionBlur * speed * 0.012;
  lensU.uEnergy.value = energy;
  lensU.uAlongPx.value = (V ? H : W) * dpr;
  lensU.uCrossPx.value = (V ? full.w : full.h) * dpr;
  lensU.uCardCross.value = P.cardCross;
  lensU.uOAspect.value = P.oAspect;
  lensU.uWarpBoost.value = P.warpBoost;
  lensU.uDispBoost.value = P.dispBoost;
  bgCol.set(P.bg);
  lensU.uBg.value.copy(bgCol);
  document.body.style.background = P.bg;

  renderer.setRenderTarget(fbo);
  renderer.setClearColor(0x000000, 0);                  // transparent: the lens knows where images are
  renderer.clear();
  renderer.render(rowScene, rowCam);
  if (P.stick > 0.001) {
    renderer.setRenderTarget(covRT);
    renderer.clear();
    renderer.render(rowScene, rowCam);
  }
  renderer.setRenderTarget(null);
  renderer.render(lensScene, lensCam);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---- entry: cards rise from below small, then grow while the portal blooms in ----
let entryTl = null;
function playEntry() {
  entryTl?.kill();
  const skip = new URLSearchParams(location.search).get("entry") === "0";   // ?entry=0 for testing
  if (!P.entry || skip) { rise.fill(1); grow.fill(1); S.fx = 1; S.entryActive = false; return; }
  S.entryActive = true;
  rise.fill(0); grow.fill(0); S.fx = 0;
  const c = wrap(Math.round(cur));
  // visible order: centre, then neighbours outward
  const order = [0, 1, -1, 2, -2].map((o) => wrap(c + o));
  const others = [...Array(N).keys()].filter((i) => !order.includes(i));
  entryTl = gsap.timeline({ onComplete: () => { S.entryActive = false; } });
  // rise in a slightly shuffled order so it feels organic
  const riseOrder = [...order].sort(() => Math.random() - 0.5);
  riseOrder.forEach((i, n) => entryTl.to(rise, { [i]: 1, duration: P.riseDuration, ease: "power3.out" }, n * P.riseStagger));
  others.forEach((i) => { rise[i] = 1; });
  const growAt = (riseOrder.length - 1) * P.riseStagger + P.riseDuration + P.growDelay;
  // edges grow first, centre last
  [...order].reverse().forEach((i, n) => entryTl.to(grow, { [i]: 1, duration: P.growDuration, ease: "expo.inOut" }, growAt + n * P.growStagger));
  others.forEach((i) => entryTl.to(grow, { [i]: 1, duration: P.growDuration, ease: "expo.inOut" }, growAt));
  entryTl.to(S, { fx: 1, duration: P.lensBloom, ease: "power2.inOut" }, growAt + P.growDuration * 0.45);
}
playEntry();

// ---- input ----
const locked = () => S.entryActive;
// the hint only needs to be read once; it fades on the first interaction
const hideHint = () => { hint.style.opacity = "0"; };
// a deliberate trip to a card (keys, clicks): normal ease, not the soft snap ease
function goTo(idx) { target = home = idx; velocity = 0; snapped = true; journey = true; lastInput = performance.now(); }
const go = (n) => { if (locked()) return; hideHint(); goTo(Math.round(target) + n); };
const along = (e) => (isV() ? e.clientY : e.clientX);
const freeInput = () => { snapped = false; journey = false; lastInput = performance.now(); };
let lastX = 0, lastT = 0, dragVel = 0, travel = 0;

canvas.addEventListener("pointerdown", (e) => {
  if (locked()) return;
  hideHint();
  dragging = true; touch = e.pointerType !== "mouse"; travel = 0; dragVel = 0; velocity = 0;
  lastX = along(e); lastT = e.timeStamp;
  canvas.setPointerCapture(e.pointerId);
  canvas.classList.add("grabbing");
  freeInput();
});
canvas.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  const p = along(e), dx = p - lastX;
  travel += Math.abs(dx);
  const step = (-dx * (touch ? 1 : P.drag)) / spacingPx();   // in cards
  target += step;
  const dt = Math.max(1, e.timeStamp - lastT) / (1000 / 60);  // in frames
  dragVel = dragVel * 0.6 + (step / dt) * 0.4;
  lastX = p; lastT = e.timeStamp;
  freeInput();
});
const release = (e) => {
  if (!dragging) return;
  dragging = false;
  canvas.classList.remove("grabbing");
  if (travel < (touch ? 12 : 6)) {
    // a tap: top quarter goes back, bottom quarter goes forward
    const r = canvas.getBoundingClientRect();
    const f = isV() ? (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width;
    if (f < 0.25) go(-1); else if (f > 0.75) go(1);
    return;
  }
  // flick only if the pointer was still moving when released
  velocity = e.timeStamp - lastT > 90 ? 0 : dragVel;
  freeInput();
};
canvas.addEventListener("pointerup", release);
canvas.addEventListener("pointercancel", release);

canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  if (locked()) return;
  hideHint();
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? H : 1;
  const d = (Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * unit;
  target += (d * P.wheel) / spacingPx();               // continuous glide, snaps once idle
  velocity = 0;
  freeInput();
}, { passive: false });

addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" && e.target.type !== "range") return;   // sliders don't take letters
  if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); go(1); }
  if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); go(-1); }
  if (e.key === "g" || e.key === "G") document.body.classList.toggle("panel-open");   // G = parameters
  if (e.key === "r" || e.key === "R") playEntry();
});

buildPanel(P, DEFAULTS, persist, { replay: playEntry });
