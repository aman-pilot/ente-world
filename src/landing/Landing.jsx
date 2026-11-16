import {lazy, Suspense, useEffect, useRef, useState} from 'react';
import GuestPanel from '../app/GuestPanel.jsx';
import IslandConnecting from '../app/IslandConnecting.jsx';
import './landing.css';
import {imgExt} from './img-format.js';
import {startHomeHeadStart,warmSignInCache,headStartJSON,settleHomeHeadStart} from '../app/home-head-start.js';
import {arrivalPending,rememberSignedIn} from '../app/arrival.js';
import {startupSession,startArrivalSocket} from '../app/arrival-start.js';

// Signed-in returns start the game behind the existing cover while the session is checked.
const returning = arrivalPending() || new URLSearchParams(location.search).has('auth');
const initialSession = startupSession(); initialSession.catch(() => {});
if (returning) {startArrivalSocket(id => {if (id === 'home') startHomeHeadStart({guest:true}); else settleHomeHeadStart(id);}); void headStartJSON('/art-prerender/islands.json').then(p => headStartJSON(p.url)).catch(() => {});}
const loadGame = () => import('../app/PixiPage.jsx');
const PixiPage = lazy(loadGame);
if (returning) void loadGame();

export default function LandingGate() {
  const [mode, setMode] = useState(returning ? 'game' : 'checking');
  const [signInAvailable, setSignInAvailable] = useState(false);
  useEffect(() => {
    if (returning) return;
    function showLanding() {
      document.documentElement.classList.remove('ew-connecting');
      setMode('landing');
    }
    initialSession.then(session => {
      rememberSignedIn(!!session.user);
      if (session.user) setMode('signed-in');
      else {
        setSignInAvailable(!!session.signInAvailable);
        showLanding();
      }
    }, showLanding);
  }, []);
  if (mode === 'signed-in') return <Suspense fallback={window.EWArrival?.t0 != null ? null : <IslandConnecting/>}><PixiPage signedInEntry/></Suspense>;
  if (mode === 'game') return <Suspense fallback={<div className="landing-boot"/>}><PixiPage/></Suspense>;
  // Watch as a guest: the GitHub-return cover closes in over the end screen, the game loads behind it, and it parts onto
  // Home the same way (PixiPage takes the cover over; no name tag for a guest)
  if (mode === 'landing') return <Landing signInAvailable={signInAvailable} onWatch={() => {
    startHomeHeadStart({guest:true});
    if (!window.EWArrival?.mount) {setMode('game'); return;}
    window.EWArrival.mount('close', 'Flying to Home'); window.EWArrival.guest = true;
    setTimeout(() => setMode('game'), 760);
  }}/>;
  return <div className="landing-boot"/>;
}

// One camera move through one sky, alive from the first frame: clouds already stream past, the globe is
// already there under the title, small and turning. The title drops in, lifts away, the camera dives through
// the clouds onto Home, and the tint and Play buttons come in while it is still gliding down.
// The clouds whoosh away over the first half second while the globe intro is already running underneath, 300 ms
// into its own clock (G0), so the feather arrives with the clouds. The globe clock runs at PACE, a touch slower
// than its native speed, so the whole thing breathes and still reaches the buttons inside 4 s.
export const G0 = 300, PACE = 2650 / 2300;   // the feather hits Home at 2.3 s, the buttons are fully in by 2.5 s
const introT = g => (g - G0) / PACE;   // globe clock -> page clock
export const LAND = introT(2950);      // the feather touches Home (scene clock)
// the cloud opening takes OPEN ms longer. The scene clock runs slow at the start and eases up to full
// speed by OPEN_T, so the clouds part gently and nothing jolts; after that it is the page clock minus OPEN. The title
// runs on the page clock, so it pops as the clouds start to part and stays up OPEN ms longer.
export const OPEN = 600, OPEN_T = 2000;
export const sceneT = t => t - OPEN * (1 - (1 - Math.min(1, Math.max(0, t) / OPEN_T)) ** 2);
export const INTRO = {
  small:{at:400, dur:520},   // ~140 ms later, after the clouds have cleared                      // "Welcome to" pops in once the clouds open (keep the v78 opening)
  big:{at:440, stagger:40, dur:760},           // POP, on a jelly spring
  titleOut:{at:Math.round(introT(2050)) + OPEN, dur:760},   // slides up off the top as the camera tips down, no fade
  cloudsUntil:1900,                           // no new cloud enters after this; the ones in flight fly past
  panelAt:Math.round(LAND) + OPEN,                   // the end screen is in place, whole and still, the moment the feather touches down
  cap:2600,                                   // the intro waits at most this long for its art, then shows the end
};

// The opening, before the globe: the first frame is inside the clouds and the camera whooshes up through them,
// then a dozen golden feathers pop out of the middle, spin in 3D like coins, shed sparkles and fly off the edges.
const WHOOSH = [{x:-.28, y:.18, w:1.05, art:2}, {x:.32, y:.3, w:1.15, art:3}, {x:-.04, y:.55, w:1.4, art:1}, {x:.42, y:-.12, w:.8, art:6}, {x:-.45, y:-.2, w:.75, art:4}];
const hash = i => {const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x);};
const expoOut = q => q >= 1 ? 1 : 1 - 2 ** (-10 * q);
// The landing: the feather sinks into Home; the feather's magic (sparkles) and a burst of feathers blast out of
// the impact while the end screen opens out from the same spot.
const BURST_N = 50;   // fewer, bigger, faster reads as more punch
const spring = (t, k = 170, d = 26) => {
  if (t <= 0) return 0;
  const w0 = Math.sqrt(k), z = d / (2 * w0);
  if (z < 1) {const wd = w0 * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + (z * w0 / wd) * Math.sin(wd * t));}
  return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
};
// instead of a white flash, the feather's own magic: the trail's glints (gold, pale gold, white four-point stars)
// blast out of the impact on springs, twinkling and turning, and shrink away as they spread
const SPARK_N = 170;   // more stars in the blast
// the end screen arrives in one beat under the blast: the map dims over 260 ms while Ducky and the buttons spring
// up from 86% out of a light blur, 120 ms after the hit; after 0.3 s the blast clears off them so they read
let clearBox = null;
const POP_AT = .3;   // seconds after the hit
function placeArrival(t) {
  const panel = document.querySelector('.guest-panel[data-plain]'), s = (t - LAND) / 1000;
  if (!panel) {clearBox = null; return;}
  const q = Math.min(1, Math.max(0, (s - .18) / .4)); panel.style.setProperty('--dim', (1 - (1 - q) ** 3).toFixed(3));   // the hit lands on the bright map; the dim follows 180 ms later over 400 ms
  // the blast peaks first, then the end screen arrives in order: the green button springs up from
  // 60% with a ~7% overshoot, Ducky peeks over it, and the guest button follows 120 ms after the green one
  panel.style.setProperty('--pop', (s > POP_AT ? spring(s - POP_AT, 320, 17) : 0).toFixed(3));
  panel.style.setProperty('--wpop', (s > POP_AT + .12 ? spring(s - POP_AT - .12, 320, 17) : 0).toFixed(3));
  panel.style.setProperty('--dpop', (s > POP_AT + .16 ? spring(s - POP_AT - .16, 300, 19) : 0).toFixed(3));   // Ducky pops with a little overshoot (~1.12)
  const r = panel.querySelector('.guest-stack')?.getBoundingClientRect();
  clearBox = r && s > POP_AT ? [r.left - 24, r.top - 110, r.right + 24, r.bottom + 24, s] : null;
}
const clearK = (x, y) => {if (!clearBox) return 1; const [l, t, r, b, s] = clearBox, dx = Math.max(l - x, 0, x - r), dy = Math.max(t - y, 0, y - b); return Math.min(1, Math.hypot(dx, dy) / 40 + Math.max(0, 1 - (s - POP_AT) / .2));};
// The blast is drawn on one canvas: 170 stars and 50 feathers as page elements were 220 moving layers, and frames
// dropped right at the hit. Same paths and timing as before; the sprites are drawn once up front.
const SPARK_TINTS = [['#fff', 0, '#fff3c4', .4, '#ffd84a', .75], ['#fff', 0, '#fff', .6, '#fff6d8', 1], ['#fff', 0, '#ffe58a', .55, '#f5b81a', 1]];
function blastSprites() {
  const star = ([c0, s0, c1, s1, c2, s2]) => {
    const n = 96, c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d');
    const p = [[.5, 0], [.59, .41], [1, .5], [.59, .59], [.5, 1], [.41, .59], [0, .5], [.41, .41]];
    g.beginPath(); p.forEach(([x, y], i) => (i ? g.lineTo(x * n, y * n) : g.moveTo(x * n, y * n))); g.closePath();
    const rg = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n * .707);
    rg.addColorStop(s0, c0); rg.addColorStop(s1, c1); rg.addColorStop(s2, c2); rg.addColorStop(1, c2);
    g.fillStyle = rg; g.fill(); return c;
  };
  const feather = new Image(); feather.src = '/pixi-art/karma/golden-feather.svg';
  const sprites = {stars:SPARK_TINTS.map(star), feather:null};
  let disposed = false;
  sprites.destroy = () => {disposed = true; for (const c of [...sprites.stars, sprites.feather]) if (c) c.width = c.height = 1; sprites.feather = null; feather.src = '';};
  feather.decode().then(() => {if (disposed) return; const n = 256, c = document.createElement('canvas'); c.width = c.height = n; c.getContext('2d').drawImage(feather, 0, 0, n, n); sprites.feather = c;}).catch(() => {});
  return sprites;
}
function sizeBlast(cv) {
  const d = Math.min(devicePixelRatio || 1, 1.5), w = Math.round(innerWidth * d), h = Math.round(innerHeight * d);
  if (cv.width !== w || cv.height !== h) {cv.width = w; cv.height = h;}
  return d;
}
function drawBlast(cv, sprites, t, at) {
  if (!cv) return;
  const s0 = (t - LAND) / 1000, ctx = cv.getContext('2d');
  if (s0 <= 0 || s0 > 2.6) {if (cv.dataset.on) {ctx.clearRect(0, 0, cv.width, cv.height); delete cv.dataset.on;} return;}
  cv.dataset.on = '1';
  const d = sizeBlast(cv); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
  const W = innerWidth, H = innerHeight, m = Math.min(W, H), [x0, y0] = at || [W / 2, H / 2], far = Math.hypot(W, H);
  const put = (img, x, y, deg, px, alpha) => {
    if (alpha <= 0 || px <= 0) return;
    ctx.setTransform(d, 0, 0, d, x * d, y * d); ctx.rotate(deg * Math.PI / 180); ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(img, -px / 2, -px / 2, px, px);
  };
  for (let i = 0; i < SPARK_N; i++) {
    const s = s0 - .006 * (i % 8), life = .8 + .7 * hash(i + 31);
    if (s <= 0 || s > life) continue;
    const a = hash(i + 41) * Math.PI * 2, reach = far * (.12 + .55 * hash(i + 43) ** 1.5);
    const go = spring(s, 40, 12), x = x0 + Math.cos(a) * reach * go, y = y0 + Math.sin(a) * reach * go - m * .05 * s * s;
    const twinkle = .65 + .35 * Math.sin(s * 22 + i * 1.7), fade = 1 - (s / life) ** 2.2;
    const k = m * (.026 + .055 * hash(i + 47)) / 24 * (.6 + .4 * spring(s, 260, 16)) * twinkle * fade;   // bright from the first frame of the hit
    put(sprites.stars[i % 3], x, y, i * 37 + s * 220 * (i % 2 ? 1 : -1), 24 * k, clearK(x, y));
  }
  if (!sprites.feather) return;
  for (let i = 0; i < BURST_N; i++) {
    const s = s0 - .2 * hash(i + 71) ** 2;   // most leave on the hit, the rest trail out over 200 ms, so the first frames read clean
    if (s <= 0 || s > 2.3) continue;
    // two tiers: a fast front ring (every third feather) thrown hard and gone quickly, and a slower drift behind it
    const ring = i % 3 === 0, a = i / BURST_N * Math.PI * 2 + (hash(i) - .5) * .5, reach = far * (ring ? 1.1 + .4 * hash(i + 9) : .6 + .5 * hash(i + 9));
    const out = ring ? spring(s, 60, 13) * (1 + .8 * s) : spring(s, 18, 8.5) * (1 + .45 * s) + .04 * s * s;
    const x = x0 + Math.cos(a) * reach * out, y = y0 + Math.sin(a) * reach * out;
    if (x < -m * .2 || x > W + m * .2 || y < -m * .2 || y > H + m * .2) continue;
    const spin = (hash(i + 5) - .5) * 540 * spring(s, 22, 8.5) + a * 57.3;
    const size = m * .075 * (.6 + .8 * hash(i + 3)) / 128 * (.7 + .3 * spring(s, 220, 18));   // pops in with a small overshoot
    put(sprites.feather, x, y, spin, 128 * size, clearK(x, y));
  }
}
// The page's first frame (index.html) has the same five clouds already drifting slowly along this same path
// (BOOT_V per ms). The intro picks them up where they are, keeps that drift for HAND ms while its first frame is
// presented under them, swaps in with no fade (the two are pixel-identical), and only then whooshes them away.
// the whoosh waits for two clean frames after the intro's set-up (the set-up's long frames
// land in the slow drift instead of the big move), then winds up and releases: cubic-bezier(.5, 0, .2, 1) over 800 ms
const BOOT_V = .25 / 5000, HAND = 140, WHOOSH_MS = 800, WHOOSH_ORDER = [1, 2, 0, 3, 4];   // the middle cloud opens first
let bootP = 0, whooshAt = Infinity;
const whooshEase = (() => {const c = (a, b, u) => 3 * a * u * (1 - u) ** 2 + 3 * b * u * u * (1 - u) + u ** 3;
  return x => {if (x <= 0) return 0; if (x >= 1) return 1; let lo = 0, hi = 1; for (let i = 0; i < 24; i++) {const m = (lo + hi) / 2; if (c(.5, .2, m) < x) lo = m; else hi = m;} return c(0, 1, lo);};})();
function placeWhoosh(clouds, T) {
  const W = innerWidth, H = innerHeight, at = Math.min(T, whooshAt), p = bootP + BOOT_V * Math.max(0, at);
  // the clouds part sideways, like the GitHub-return cover: each one slides off its own side (the low middle one
  // drops away), growing a little as it goes, each a beat after the last
  const eOf = i => T < whooshAt ? 0 : whooshEase(Math.max(0, T - whooshAt - WHOOSH_ORDER[i] * 35) / WHOOSH_MS);
  clouds.forEach((node, i) => {
    const e = eOf(i), c = WHOOSH[i], k = c.w * Math.max(W, H * .75) / 300 * (1.25 + 1.1 * p) * (1 + .35 * e);   // a tall phone: sized by height too, so the bank fills the screen
    const x = c.x * W * (1 + 1.3 * p), y = c.y * H + p * H * 2.4, half = 150 * k;
    const down = Math.abs(c.x) < .2 && c.y > .4;
    const dx = down ? 0 : ((c.x < 0 ? -1 : 1) * (W / 2 + half) - x) * e, dy = down ? (H / 2 + half * .55 - y) * e : 0;
    node.style.transform = `translate(-50%,-50%) translate(${x + dx}px,${y + dy}px) scale(${k})`;
    node.style.opacity = e >= 1 ? 0 : 1;   // gone once it is off the edge
  });
}


// each letter's resting tilt and lift, as on the Rewind site
const REST = [[-3, 0], [2, -.03], [-1, .02], [2, -.02], [-2, .02], [3, -.02]];

// the globe code starts downloading the moment this file runs, not after React has drawn the page
let globeModule;
// the end screen's Ducky is decoded while the intro plays, so the buttons arrive without a decode stall; it is fetched
// only once Home's pictures are in, so on a slow line it never takes bandwidth from the globe or the island
const warmDucky = () => ['body', 'beak', 'wings'].forEach(part => {const img = new Image(); img.src = `/guest/ducky-peek-${part}.webp`; img.decode?.().catch(() => {});});

export function Landing({signInAvailable, onWatch}) {
  const root = useRef(null);
  const canvas = useRef(null);
  const [panel, setPanel] = useState(false);
  const [settled] = useState(() => {
    // the intro plays on every visit; only reduced motion skips straight to the end screen
    try {return matchMedia('(prefers-reduced-motion: reduce)').matches;}
    catch {return false;}
  });

  useEffect(() => {
    const el = root.current, I = INTRO, timers = [];
    let cancelled = false, globe = null, frame = 0, start = null, done = false, panelAt = Infinity, good = 0, lastNow = 0;
    whooshAt = Infinity;
    const later = (fn, ms) => timers.push(setTimeout(() => !cancelled && fn(), ms));
    const globeReady = (globeModule ??= import('./globe-intro.js'))
      .then(m => imgExt.then(x => m.createGlobeIntro(canvas.current, {ext:x, home:{ground:`/guest/home-ground.${x}`, props:`/guest/home-props.${x}`}})))
      .then(g => {if (cancelled) g.destroy(); else {globe = g; g.homeReady.then(warmDucky);} return g;}).catch(() => {warmDucky(); return null;});
    const whoosh = [...el.querySelectorAll('.ld-whoosh')], blastCv = document.querySelector('.ld-flurry'), blast = blastSprites();
    const releaseBlast = () => {if (blastCv) blastCv.width = blastCv.height = 1; blast.destroy();};
    const cloudsSet = Promise.resolve(whoosh.forEach((img, i) => {img.src = window.EWClouds.url(WHOOSH[i].art);}));   // code-drawn clouds (index.html)
    let landAt = null;   // where Home is on screen when the feather touches it
    const paint = T => {
      const t = sceneT(T);
      if (globe && !landAt) {landAt = globe.homeOnScreen(2950); el.style.setProperty('--rx', landAt[0] + 'px'); el.style.setProperty('--ry', landAt[1] + 'px');}   // the end screen opens out from the impact
      globe?.draw(Math.max(0, G0 + t * PACE));
      placeWhoosh(whoosh, T);
      placeArrival(t);
      drawBlast(blastCv, blast, t, landAt);
    };
    placeWhoosh(whoosh, 0);   // and starts inside the cloud bank
    // the page's own first frame (index.html) cross-fades into the intro, which is already moving underneath it
    const dropBoot = () => {const b = document.getElementById('boot-sky'); if (b) b.animate([{opacity:1}, {opacity:0}], {duration:260, easing:'ease-out'}).finished.then(() => b.remove(), () => b.remove());};
    const finish = () => {
      dropBoot();
      if (done) return; done = true;
      el.dataset.introDone = 'true';
      // the clock runs on only while the landing flurry is still in the air
      if (start === null) start = performance.now() - (LAND + OPEN + 2400);   // a returning visitor or a skip starts after the flurry
      cancelAnimationFrame(frame);
      const idle = now => {if (cancelled) return; const t = sceneT(now - start); globe?.draw(G0 + t * PACE); placeArrival(t); drawBlast(blastCv, blast, t, landAt); if (t < LAND + 2400) frame = requestAnimationFrame(idle); else globe?.still();};   // the flurry has gone: one full-sharpness still frame   // runs until the flurry has flown off, then the end screen is still
      frame = requestAnimationFrame(idle);
      // a returning visitor or reduced motion lands on the still end frame at once, maybe before Home's full pictures are
      // in (check: it stayed blurry); redraw the still once they arrive
      // (the trees and houses fade up over 400 ms after that, so it draws once more when they are fully in)
      globe?.homeReady.then(() => {const again = () => {if (!cancelled && done) globe.still();}; again(); later(again, 450);});
      setPanel(true);
      warmSignInCache();
      // fetch the game code quietly once the landing has settled: download only, nothing runs, so the
      // end screen never freezes while the game code is evaluated (importing it here froze the end screen for 0.5 s)
      later(warmSignInCache, 1500);
    };
    const loop = now => {
      if (cancelled || done) return;
      const t = now - start;
      if (whooshAt === Infinity && t >= HAND) {good = lastNow && now - lastNow < 20 ? good + 1 : 0; if (good >= 4 || t > 700) whooshAt = t;}
      lastNow = now;
      paint(t);
      if (t >= HAND) {const b = document.getElementById('boot-sky'); if (b && !b.dataset.arrive) b.remove();}   // the intro's frame is on screen and matches: swap, no fade
      if (t >= panelAt) setPanel(true);
      if (sceneT(t) >= Math.max(introT(globe.total), LAND + 1200)) finish(); else frame = requestAnimationFrame(loop);
    };
    function onResize() {globe?.resize();}
    addEventListener('resize', onResize);
    // a tab that was in the background comes back with an empty canvas; the end screen is a still frame, so draw it again.
    // visibilitychange fires before the tab is on screen and Chrome drops a frame drawn then, so the redraw waits for
    // the first real frame, and once more just after it
    const onShow = () => {if (document.hidden) return; requestAnimationFrame(() => {if (done && globe && !cancelled) globe.still();}); later(() => done && globe?.still(), 250);};
    document.addEventListener('visibilitychange', onShow);
    addEventListener('focus', onShow);

    if (settled) {
      globeReady.then(() => !cancelled && finish());
      setPanel(true);
      warmSignInCache();
      later(() => {const p = document.querySelector('.guest-panel[data-plain]'); p?.style.setProperty('--dim', 1); p?.style.setProperty('--pop', 1); p?.style.setProperty('--dpop', 1); p?.style.setProperty('--wpop', 1);}, 60);   // returning visitors: in place, no arrival
      return () => {cancelled = true; cancelAnimationFrame(frame); timers.forEach(clearTimeout); removeEventListener('resize', onResize); document.removeEventListener('visibilitychange', onShow); removeEventListener('focus', onShow); globe?.destroy(); releaseBlast();};
    }

    function titleAnimations() {
      const all = sel => [...el.querySelectorAll(sel)];
      // the title stays pinned to the sky: as the camera tips down into the dive it slides up off the top of the
      // screen, speeding up with the camera, never fading
      const out = () => el.querySelector('.ld-title').animate(
        [{transform:'none'}, {transform:'translateY(-120vh)'}],
        {duration:I.titleOut.dur, delay:I.titleOut.at, easing:'cubic-bezier(.5,0,.6,1)', fill:'both'});
      // 1, BOUNCY, the Rewind site hero move: every letter starts at the centre of the screen, small, and flies to
      // its own spot with a smear and an overshoot, then a white shine sweeps across the word once it has landed
      // a damped spring sampled into keyframes and played linearly between them: one continuous jelly wobble, no
      // corners between keyframes. Scale overshoots ~10%, squash runs a quarter-cycle behind it so the letter
      // stretches on the way up and flattens on the way back, all settling together
      const jelly = (amp, rot) => {
        const n = 40, w = 2 * Math.PI * 1.55, z = .32, out = [];
        for (let i = 0; i <= n; i++) {
          const u = i / n, e = Math.exp(-z * w * u * 2.2), sc = 1 - e * Math.cos(w * u), sq = amp * e * Math.sin(w * u);
          out.push({scale:`${(sc * (1 - sq)).toFixed(4)} ${(sc * (1 + sq)).toFixed(4)}`, rotate:`${(rot * e * Math.cos(w * u)).toFixed(2)}deg`, offset:u});
        }
        out[n] = {scale:'1 1', rotate:'0deg', offset:1};
        return out;
      };
      all('.ld-small i').forEach((ch, k) => {
        const d = I.small.at + k * 16;
        ch.animate(jelly(.06, 0), {duration:640, delay:d, easing:'linear', fill:'both'});
        ch.animate([{opacity:0}, {opacity:1}], {duration:90, delay:d, fill:'both'});
      });
      // each letter grows out of a dot, a little past full size, and wobbles to rest
      const L = {dur:I.big.dur, stagger:I.big.stagger};
      const word = el.querySelector('.ld-big'), wr = word.getBoundingClientRect();
      const letters = all('.ld-big i.L');
      word.style.setProperty('--ww', wr.width + 'px');
      letters.forEach((ch, k) => {
        const r = ch.getBoundingClientRect(), d = I.big.at + k * L.stagger, s = k % 2 ? 1 : -1;
        ch.style.setProperty('--ox', (r.left - wr.left) + 'px');
        ch.animate(jelly(.1, s * 10), {duration:L.dur, delay:d, easing:'linear', fill:'both'});
        ch.animate([{opacity:0}, {opacity:1}], {duration:90, delay:d, fill:'both'});
      });
      const landed = I.big.at + (letters.length - 1) * L.stagger + L.dur;
      // then a soft light glides through the letters, and each letter's star blooms as the light's centre crosses it
      // the light and the stars start only once every letter has popped; as soon as the
      // last one has visibly settled (~480 ms into its pop), not at the end of its wobble, so the payoff gets time before the dive
      const io = 'cubic-bezier(.45,0,.55,1)', from = landed - L.dur + 480,
         dur = 720, x0 = -wr.width * .6, x1 = wr.width * 1.1, band = wr.width * .6 / 2;
      word.animate([{'--sx':`${x0}px`}, {'--sx':`${x1}px`}], {duration:dur, delay:from, easing:io, fill:'both'});
      const bez = u => {const c = (a, b) => 3 * a * u * (1 - u) ** 2 + 3 * b * u * u * (1 - u) + u ** 3; return [c(.45, .55), c(0, 1)];};
      const timeAt = p => {let lo = 0, hi = 1; for (let i = 0; i < 30; i++) {const m = (lo + hi) / 2; if (bez(m)[1] < p) lo = m; else hi = m;} return bez(lo)[0];};
      word.querySelectorAll('.ld-gl').forEach(n => n.remove());
      letters.forEach((ch, k) => {
        const lx = ch.offsetLeft, lw = ch.offsetWidth, p = Math.min(1, Math.max(0, (lx + lw / 2 - band - x0) / (x1 - x0)));   // layout box: the pop's scale doesn't move it
        const g = document.createElement('span'); g.className = 'ld-gl' + (k % 3 === 1 ? ' sm' : '');
        g.style.left = `calc(${lx + lw * .78}px - .21em)`; g.style.top = `calc(${k % 2 ? 10 : 2}% - .21em)`;
        word.appendChild(g);
        const at = from + Math.max(0, timeAt(p) * dur - 60), d = 620;
        g.animate([{opacity:0, scale:'.15', easing:io}, {opacity:1, scale:'1', offset:.45, easing:io}, {opacity:0, scale:'.15'}], {duration:d, delay:at, fill:'both'});
        g.animate([{rotate:'0deg'}, {rotate:'70deg'}], {duration:d, delay:at, easing:'linear', fill:'both'});
      });
      // never dead still; a slow 3 px float from the moment the letters settle (translate,
      // separate from the exit's transform)
      el.querySelector('.ld-title').animate([{translate:'0 0'}, {translate:'0 -3px'}], {duration:1100, delay:landed - L.dur + 420, easing:'cubic-bezier(.45,0,.55,1)', iterations:Infinity, direction:'alternate'});
      out();
    }

    function play(g) {
      if (cancelled) return;
      if (!g) {finish(); return;}
      bootP = window.__bootP?.() ?? 0;
      if (document.getElementById('boot-sky')?.dataset.arrive) dropBoot();   // back from GitHub but not signed in: fade the cover
      placeWhoosh(whoosh, 0);
      el.dataset.playing = 'true';
      titleAnimations();
      panelAt = I.panelAt;
      start = performance.now();
      frame = requestAnimationFrame(loop);
    }
    function skip() {
      el.getAnimations({subtree:true}).forEach(a => {try {a.finish();} catch {/* ignore */}});
      globeReady.then(() => !cancelled && finish());
    }
    // the globe is on screen from the first frame, so the clock starts once it and the font are ready
    // start only when frame one is complete: globe textures, cloud art and the font, capped so a slow network
    // never holds the page; past the cap the intro is skipped and the end screen shows
    const decoded = cloudsSet.then(() => Promise.all(whoosh.map(img => img.decode().catch(() => {}))));
    const art = Promise.all([globeReady, decoded, Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1000))])]).then(([g]) => g);
    Promise.race([art, new Promise(r => setTimeout(() => r('late'), I.cap))]).then(g => setTimeout(() => (g === 'late' ? globeReady.then(() => !cancelled && finish()) : play(g)), 30));
    window.addEventListener('pointerdown', skip, {once:true});
    window.addEventListener('keydown', skip, {once:true});
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      cancelAnimationFrame(frame);
      removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onShow); removeEventListener('focus', onShow);
      window.removeEventListener('pointerdown', skip);
      window.removeEventListener('keydown', skip);
      globe?.destroy();
      releaseBlast();
    };
  }, [settled]);


  // a letter: the face, and a shine copy on top that a white band sweeps across
  const pop = text => [...text].map((c, i) => c === ' ' ? <i key={i}>{'\u00a0'}</i> :
    <i key={i} className="L" style={{'--r':`${REST[i % 6][0]}deg`, '--y':`${REST[i % 6][1]}em`}}><span className="face">{c}</span><b className="sh" aria-hidden="true">{c}</b></i>);
  const line = text => [...text].map((c, i) => <i key={i}>{c === ' ' ? '\u00a0' : c}</i>);
  return <main className="landing pixi-page-guest" ref={root} data-settled={settled}>
    <div className="ld-sky"/>
    <canvas className="ld-globe" ref={canvas} aria-hidden="true"/>
    <div className="ld-intro" aria-hidden="true">
      {WHOOSH.map((_, i) => <img key={'w' + i} className="ld-cloud ld-whoosh" alt=""/>)}
      <div className="ld-title">
        <span className="ld-small">{line('Welcome to')}</span>
        <span className="ld-big">{pop('Ente World')}</span>
      </div>
    </div>
    <img className="ld-ente" src="/ente-wordmark-white.svg" alt="Ente" width="844" height="264"/>
    {panel && <GuestPanel signInAvailable={signInAvailable} onWatch={onWatch} plain/>}
    <canvas className="ld-flurry" aria-hidden="true"/>
  </main>;
}
