import * as THREE from 'three';
import {GROUND_LQ, CLOUDS_LQ} from './intro-placeholders.js';

// A light globe for the landing, separate from the game: an ocean ball with the game's own island art laid
// on it (Home on the front, its neighbours around it). It is on screen from the first frame, far away under
// the title, turning; one curve brings it closer and dives until Home fills the screen. The last frame is the
// landing background.
const TAU = Math.PI * 2;
const ISLAND = {width:.62, height:.465};   // radians of longitude and latitude Home covers (its art is 4:3)
// the real island art around Home: centre longitude and latitude, and width, in radians (height keeps 4:3)
const NEIGHBOURS = [
  ['sunflower', -.72, .24, .4], ['pink', .72, .28, .4], ['canal', -.62, -.34, .38], ['community', .7, -.3, .4],
]
const END_SPAN = .5;   // the final frame shows the middle half of Home, centred on the plaza
const FOV = 35;
const easeOut = x => 1 - (1 - x) ** 3;
const easeInOut = x => x < .5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2;
const clamp01 = x => Math.min(1, Math.max(0, x));
// CSS-style cubic-bezier(x1, y1, x2, y2), solved for x by Newton steps then bisection
function bezier(x1, y1, x2, y2) {
  const f = (a, b, s) => 3 * a * s * (1 - s) ** 2 + 3 * b * s * s * (1 - s) + s ** 3;
  const df = (a, b, s) => 3 * a * (1 - s) ** 2 + 6 * (b - a) * s * (1 - s) + 3 * (1 - b) * s * s;
  return x => {
    if (x <= 0 || x >= 1) return clamp01(x);
    let s = x;
    for (let i = 0; i < 6; i++) { const d = df(x1, x2, s); if (Math.abs(d) < 1e-6) break; s -= (f(x1, x2, s) - x) / d; }
    if (s < 0 || s > 1) { let lo = 0, hi = 1; s = x; for (let i = 0; i < 30; i++) { if (f(x1, x2, s) < x) lo = s; else hi = s; s = (lo + hi) / 2; } }
    return f(y1, y2, s);
  };
}

export async function createGlobeIntro(canvas, {home, ext = 'webp', neighbours = '/guest/globe-', feather = '/pixi-art/karma/golden-feather.svg'}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true});
  // while it moves the globe draws at 1.5x (a retina screen at 2x is ~1.8x the pixels, which cost frames in the dive and
  // the blast on 120 Hz screens); once the end screen is still, still() redraws it once at full 2x sharpness
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(FOV, 1, .001, 50);
  const loader = new THREE.TextureLoader();
  // each picture goes to the GPU the moment it is decoded, so the first frames of the intro never stall on an upload
  // pictures are decoded and flipped off the main thread (createImageBitmap), so swapping a big one in mid-flight costs
  // only the GPU copy, not a decode inside a frame; browsers without it fall back to a plain image
  const bitmaps = typeof createImageBitmap === 'function' && new THREE.ImageBitmapLoader().setOptions({imageOrientation:'flipY', premultiplyAlpha:'none'});
  const fetchTex = url => bitmaps ? bitmaps.loadAsync(url).then(bm => {const t = new THREE.Texture(bm); t.flipY = false; t.needsUpdate = true; return t;}) : loader.loadAsync(url);
  const prep = t => {t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); renderer.initTexture(t); return t;};
  const load = url => fetchTex(url).then(prep);
  // the opening stuttered (33-83 ms frames at 0.35-1 s) while full pictures were uploaded to the GPU.
  // Pictures that arrive early wait until the opening is over (OPENED on the globe clock, in the quiet beat between the title shimmer and the dive, while the globe is still
  // small), then upload one per frame
  const OPENED = 2250;   // page ~2.3 s: the title has landed and its shimmer is done, the dive has not started
  let opened, queue = Promise.resolve();
  const openedP = new Promise(res => {opened = res;});
  // pictures that land before the intro has drawn its first frame upload straight away (the page's clouds still cover it)
  let drawing = false;
  const inTurn = t => (queue = queue.then(() => drawing ? openedP : null).then(() => new Promise(r => requestAnimationFrame(() => r())))).then(() => prep(t));
  // the golden feather: the thing you collect in the game leads you in
  // every picture is fetched at once (index.html already asked for them before any script ran), never one after another
  const [featherArt, cloudArt, [skyTex, groundTex]] = await Promise.all([
    new Promise(res => {const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = feather;}),
    // the fly-through clouds are the code-drawn ones (index.html), drawn to a canvas at 1280 wide so they stay crisp up close
    Promise.all([1, 2, 3, 4, 5, 6].map(n => new Promise((res, rej) => {const im = new Image(); im.onload = () => {const c = document.createElement('canvas'); c.width = 1280; c.height = Math.round(1280 * im.naturalHeight / im.naturalWidth); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res(c);}; im.onerror = rej; im.src = window.EWClouds.url(n);}))),
    // the cloud cover and the Home ground start as tiny stand-ins inside the page code, so nothing here waits on the network
    Promise.all([load(CLOUDS_LQ), load(GROUND_LQ)]),
  ]);
  // the full pictures swap in as they land: Home's ground first, then its trees and houses, then the cloud cover and the
  // neighbours, so the bytes go to what the dive ends on
  const upgrade = (url, apply) => fetchTex(url).then(inTurn).then(apply).catch(() => {});
  // the four neighbour islands are small on the ball, so the intro does not wait for them: each fades in when it lands
  const nearTex = [];
  skyTex.wrapS = THREE.RepeatWrapping;

  const globe = new THREE.Group();
  scene.add(globe);
  // the sea is the live globe's: one flat colour, (.2, .52, .86) as the world view's planet shader paints it
  const world = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.MeshBasicMaterial({color:new THREE.Color().setRGB(.2, .52, .86, THREE.SRGBColorSpace)}));
  globe.add(world);
  // an island laid on the ball as a patch of sphere: lon to the right, lat up, from the front of the ball
  const decal = (tex, lon, lat, w, h, r) => new THREE.Mesh(
    new THREE.SphereGeometry(r, 64, 48, Math.PI / 2 + lon - w / 2, w, Math.PI / 2 - lat - h / 2, h),
    new THREE.MeshBasicMaterial({map:tex, transparent:true, depthWrite:false}));
  let homeLanded; const afterHome = new Promise(res => {homeLanded = res;});
  // Home's bytes first (ground, then trees and houses)
  const groundBytes = fetchTex(home.ground), propsBytes = groundBytes.then(() => fetchTex(home.props));
  // for the first two seconds the turning ball showed only sea, because the islands all sit beside Home. The four
  // neighbours are also laid round the far side of the ball (the same four pictures, turned and resized, nothing more to
  // download), and they are fetched as soon as Home's bytes are in and uploaded at once (small, about 1 ms each), so the
  // world is full from the first turn
  const P = Math.PI;   // half the copies are turned upside down, so no two neighbours look alike side by side
  const FAR = [['pink', -1.45, .2, .36, P], ['canal', -1.9, -.3, .34, 0], ['community', -2.35, .3, .38, 0], ['sunflower', -2.8, -.15, .34, P],
    ['sunflower', 1.5, -.25, .36, P], ['community', 1.95, .25, .34, P], ['pink', 2.4, -.2, .36, 0], ['canal', 2.85, .2, .34, P]];
  const byName = {};
  const islandTex = name => byName[name] ??= groundBytes.catch(() => null).then(() => fetchTex(`${neighbours}${name}.${ext}`)).then(prep);
  [...NEIGHBOURS.map(n => [...n, 0]), ...FAR].forEach(([name, lon, lat, w, spin]) => {
    const m = decal(null, lon, lat, w, w * .75, 1.001);
    m.visible = false; m.material.opacity = 0; globe.add(m);
    islandTex(name).then(tex => {
      if (!nearTex.includes(tex)) nearTex.push(tex);
      if (spin) {tex = tex.clone(); tex.center.set(.5, .5); tex.rotation = spin; tex.needsUpdate = true; nearTex.push(tex);}
      m.material.map = tex; m.material.needsUpdate = true; m.visible = true;
      const t0 = performance.now(), fade = now => {m.material.opacity = Math.min(1, (now - t0) / 300); if (m.material.opacity < 1) requestAnimationFrame(fade);};
      requestAnimationFrame(fade);
    }).catch(() => {});
  });
  // Home in three layers: ground, the soft shadow its trees and houses cast, and the trees and houses lifted a
  // little above the ground, so the last part of the dive opens up with real parallax instead of a flat zoom
  const homeGround = decal(groundTex, 0, 0, ISLAND.width, ISLAND.height, 1.0015);
  // the trees and houses (the biggest picture) are only seen once the camera dives in, so the intro does not wait
  // for them: they stream in during the opening and fade up, usually long before the dive
  // (it starts with the ground picture as a stand-in at zero opacity, so its shader is built with the rest up front
  // and swapping the real picture in later costs no compile)
  const homeProps = decal(groundTex, 0, 0, ISLAND.width, ISLAND.height, 1.016);
  homeProps.material.opacity = 0;
  let propsTex = null, groundFull = null, skyFull = null;
  // bytes in order (ground, then trees and houses), each uploaded in its turn once the opening is over
  propsBytes.catch(() => {});
  // both full pictures upload in their turns, then swap in on the same frame: the stand-in already shows the trees and
  // houses, so the full ground must never show without them
  const homeReady = Promise.all([groundBytes.then(inTurn), propsBytes.then(inTurn)]).then(([ground, props]) => {
    groundFull = ground; propsTex = props;
    homeGround.material.map = ground; homeProps.material.map = props; homeProps.material.opacity = 1;
  }).catch(() => {});
  homeReady.then(() => {homeLanded(); upgrade(`/guest/globe-clouds.${ext}`, tex => {skyFull = tex; tex.wrapS = THREE.RepeatWrapping; clouds.material.uniforms.map.value = tex;});});
  homeGround.renderOrder = 1;
  globe.add(homeGround, homeProps);
  // Light, clouds, rim and air, the live globe's numbers (world-view.js planet() and globe-clouds.js), as layers
  // over the ball in the same order: shade, highlight, the cloud layer, then the pale rim. Normals are in view space.
  const VS = 'varying vec3 n; varying vec3 lp; void main(){ lp = position; n = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }';
  const LIT = 'float lit = dot(n, normalize(vec3(-.5,.5,.72)));';
  const overlay = (r, frag, opts) => new THREE.Mesh(new THREE.SphereGeometry(r, 96, 64), new THREE.ShaderMaterial({transparent:true, depthWrite:false, vertexShader:VS, fragmentShader:frag, ...opts}));
  // the far side dims: col * (.72, .8, .98)
  const shade = overlay(1.002, `varying vec3 n; void main(){ ${LIT} gl_FragColor = vec4(mix(vec3(1.), vec3(.72,.8,.98), 1. - smoothstep(.12,.3,lit)), 1.); }`,
    {blending:THREE.MultiplyBlending, premultipliedAlpha:true});
  // the lit side brightens: + (.06, .07, .08)
  const shine = overlay(1.0025, `varying vec3 n; void main(){ ${LIT} gl_FragColor = vec4(vec3(.06,.07,.08) * smoothstep(.8,.95,lit), 1.); }`,
    {blending:THREE.AdditiveBlending});
  // the cloud layer: the live texture, coverage smoothstep(.12, .85), 48% opacity, lit from (-.45, .6, 1), drifting
  const clouds = overlay(1.006, `varying vec3 n; varying vec3 lp; uniform sampler2D map; uniform float phase, k;
    void main(){
      vec3 p = normalize(lp); p = vec3(p.x, .9781476*p.y - .2079117*p.z, .2079117*p.y + .9781476*p.z);
      vec2 uv = vec2((atan(p.z, p.x) + phase + .4) / 6.28318530718 + .5, .5 - asin(clamp(p.y, -1., 1.)) / 3.14159265359);
      float cover = smoothstep(.12, .85, texture2D(map, uv).r);
      float light = clamp(dot(n, normalize(vec3(-.45,.6,1.))) / normalize(vec3(-.45,.6,1.)).z, 0., 1.);
      gl_FragColor = vec4(mix(vec3(.65,.78,.88), vec3(1.,.99,.97), light), cover * .48 * smoothstep(.035,.30,n.z) * k);
    }`, {uniforms:{map:{value:skyTex}, phase:{value:0}, k:{value:1}}});
  globe.add(clouds);
  // the pale rim: (.55, .82, 1) over the last 6% of the radius
  const rim = overlay(1.007, `varying vec3 n; uniform float k; void main(){ float edge = length(n.xy); gl_FragColor = vec4(.55,.82,1., pow(smoothstep(.94,1.,edge),2.) * .45 * k); }`,
    {uniforms:{k:{value:1}}});
  scene.add(shade, shine, rim);
  // the air just outside the ball: (.36, .68, 1) at 70%, gone within about 7 px
  const halo = new THREE.Mesh(new THREE.SphereGeometry(1.12, 64, 48), new THREE.ShaderMaterial({
    transparent:true, depthWrite:false, side:THREE.BackSide, uniforms:{k:{value:1}, c:{value:new THREE.Vector3()}, w:{value:.01}},
    vertexShader:'varying vec3 vp; void main(){ vec4 p = modelViewMatrix * vec4(position,1.); vp = p.xyz; gl_Position = projectionMatrix * p; }',
    fragmentShader:'varying vec3 vp; uniform vec3 c; uniform float k, w; void main(){ vec3 d = normalize(vp); float miss = length(c - d * dot(c, d)); if (miss < 1.) discard; gl_FragColor = vec4(.36,.68,1., .7 * exp(-(miss - 1.) / w) * k); }',
  }));
  scene.add(halo);
  shade.renderOrder = 2; shine.renderOrder = 2; clouds.renderOrder = 2; rim.renderOrder = 2;
  homeProps.renderOrder = 1;
  // clouds float above the sea as camera-facing billboards, so they read at altitude instead of painted on;
  // two sit on the edges of the dive corridor and sweep past as the camera drops onto Home
  const cloudTex = cloudArt.map(im => {const t = new THREE.Texture(im); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t;});
  // a bank of clouds on the planet's horizon: they ride on the ball, so they turn with it and the near ones sweep
  // past the camera on the way down. [longitude, latitude, height above the sea, size]; the ball starts tilted
  // half a radian towards us, so latitude .45-.8 is the skyline and lower ones float over the sea at the sides
  // phone only: four clouds either side of Home, [longitude, latitude], so the dive is not empty on a narrow screen;
  // late in the dive they only move outward, off the edges, so the end screen has none
  const NEAR_HOME = [[-.42, .1], [.43, -.05], [-.38, -.27], [.4, .25]];
  const BANK = [
    [-1.25, .38, 1.05, .32], [-.95, .48, 1.05, .27], [-.66, .54, 1.05, .23], [-.3, .6, 1.05, .17],
    [.32, .6, 1.05, .17], [.68, .54, 1.05, .23], [.98, .47, 1.05, .28], [1.28, .38, 1.05, .32],
    [-.72, .2, 1.12, .2], [.78, .1, 1.12, .2], [-.42, -.22, 1.14, .16], [.5, -.3, 1.14, .17],
    // the layer the camera dives through: low over Home, just off the centre line, so they rush past the edges
    [-.13, .06, 1.16, .16], [.15, -.04, 1.17, .17], [-.05, -.12, 1.13, .13], [.08, .13, 1.14, .13],
  ];
  // sky clouds: real clouds in the 3D sky above and behind the planet, at different depths, so they move with every
  // camera change (parallax as the planet rises, sliding up and away as the camera tips into the dive) and drift slowly
  // [x, y, z, size, drift per second]
  const SKY = [[-1.5, 1.55, -.6, .5, .03], [1.35, 1.75, -1.2, .6, .022], [-.6, 2.05, -2.2, .7, .016], [.55, 1.45, .15, .32, .04],
    [-2.2, 1.95, -1.8, .65, .018], [2.05, 1.5, -.3, .45, .03], [.05, 2.35, -2.8, .8, .012]];
  const sky = SKY.map(([x, y, z, size, drift], i) => {
    const tex = cloudTex[(i * 5) % cloudTex.length], im = cloudArt[(i * 5) % cloudArt.length];
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({map:tex, transparent:true, depthWrite:false}));
    sp.scale.set(size, size * im.height / im.width, 1);
    sp.userData = {x, y, z, drift};
    sp.renderOrder = 0; scene.add(sp);
    return sp;
  });
  const billboards = BANK.map(([lon, lat, r, size], i) => {
    const tex = cloudTex[i % cloudTex.length], im = cloudArt[i % cloudArt.length];
    // drawn over the ball, never depth-tested (otherwise the ball's edge cuts the horizon clouds flat)
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({map:tex, transparent:true, depthWrite:false, depthTest:false}));
    sp.position.set(Math.sin(lon) * Math.cos(lat) * r, Math.sin(lat) * r, Math.cos(lon) * Math.cos(lat) * r);
    sp.scale.set(size * 1.55, size * 1.55 * im.height / im.width, 1);
    sp.renderOrder = 3; sp.userData = {dive:i >= 12, lon, lat, r, i, base:sp.scale.clone()};   // the fly-through layer slides in over Home as the camera comes down
    globe.add(sp);
    return sp;
  });



  // feather sprite (drawn from the SVG at 256 px so it stays crisp up close), a sparkle trail and a landing burst
  const paintTex = (w, h, fn) => {const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;};
  const featherTex = featherArt && paintTex(256, 256, (g, w, h) => g.drawImage(featherArt, 0, 0, w, h));
  const dotTex = paintTex(64, 64, (g, w) => {const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.25, 'rgba(255,236,150,1)'); r.addColorStop(.6, 'rgba(255,200,61,.55)'); r.addColorStop(1, 'rgba(255,200,61,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w);});
  // a flat card, not a sprite, so it can bank and twist in perspective as it flies
  const featherSp = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({map:featherTex || dotTex, transparent:true, depthWrite:false, depthTest:false, side:THREE.DoubleSide}));   // always on top: in sight all the way into the land
  featherSp.renderOrder = 5; scene.add(featherSp);
  // the trail is magic dust: small four-point sparkles in gold and white, each born on the feather's path a little
  // off the line, twinkling, turning, drifting outward and shrinking away as it ages
  const starTex = paintTex(128, 128, (g, w) => {
    const c = w / 2, glow = g.createRadialGradient(c, c, 0, c, c, c);
    glow.addColorStop(0, 'rgba(255,255,255,1)'); glow.addColorStop(.16, 'rgba(255,246,200,.85)'); glow.addColorStop(.42, 'rgba(255,214,90,.35)'); glow.addColorStop(1, 'rgba(255,200,60,0)');
    g.fillStyle = glow; g.fillRect(0, 0, w, w);
    g.fillStyle = '#fff'; g.beginPath();
    for (let k = 0; k < 8; k++) {const a = k * Math.PI / 4, r = k % 2 ? w * .07 : w * .48; g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);}
    g.closePath(); g.fill();
  });
  const GOLD = new THREE.Color(1, .82, .35), WHITE = new THREE.Color(1, 1, 1), PALE = new THREE.Color(1, .95, .62);
  const hash = i => {const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x);};
  const TRAIL = 120, TRAIL_GAP = 7, TRAIL_LIFE = TRAIL * TRAIL_GAP;
  const trail = Array.from({length:TRAIL}, (_, i) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({map:starTex, color:i % 3 ? GOLD : WHITE, transparent:true, depthWrite:false, depthTest:false}));
    sp.renderOrder = 4; scene.add(sp); return sp;
  });
  const burst = new THREE.Sprite(new THREE.SpriteMaterial({map:dotTex, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending}));
  burst.renderOrder = 6; scene.add(burst);

  // the feather's flight on screen (see screenAt below); defined before resize(), which reshapes it on phones
  const PATH = [[0, -1.12, -.1], [262, -.589, .228], [525, -.248, .564], [744, .074, .66], [962, .521, .528], [1138, .601, .258], [1295, .484, -.132], [1444, .186, -.342], [1575, -.155, -.204], [1689, -.31, .054], [1794, -.378, .36], [1899, -.329, .648], [2004, -.081, .81], [2100, .056, .714], [2680, .081, .36], [2950, 0, -.25]];   // traced from a hand-drawn path
  const PATH_BASE = PATH.map(p => p.slice());
  let width = 1, height = 1, end = 1.5, touchdown = null, isPhone = false;   // touchdown: Home's spot on screen at the landing (NDC), per screen shape
  function resize() {
    width = canvas.clientWidth || innerWidth; height = canvas.clientHeight || innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height; camera.updateProjectionMatrix();
    // the final camera height: the island's middle 72% covers the screen, whatever its shape
    const t = Math.tan(FOV * Math.PI / 360);
    end = 1 + Math.min(END_SPAN / 2 * ISLAND.height / t, END_SPAN / 2 * ISLAND.width / (t * camera.aspect));
    // layout 1, the planet horizon: a huge ball rises from the bottom edge, wider than the screen, its top at
    // 44% down on desktop (52% on phones), so the title has the sky above it and the islands sit close
    const phone = width < 600;
    isPhone = phone;
    // on phones, the globe read as clouds and empty sea; on phones it is drawn bigger, so Home and its neighbours are larger
    look.diam = (phone ? 2.1 : 1.12) * width / height;
    look.y = (phone ? .52 : .44) + look.diam / 2;
    look.px = 1 / height;
    // on phones, the feather's loop round the title came in low and tall-and-thin; on phones it is lifted onto the
    // title and squashed into a rounder loop (the touchdown point stays pinned to Home)
    PATH.forEach((p, i) => {const b = PATH_BASE[i]; p[1] = b[1]; p[2] = phone && i < PATH.length - 1 ? .4 + b[2] * .48 : b[2];});
    touchdown = null;   // screenAt rebuilds the flight from the new points
    touchdown = null;
  }
  const look = {diam:.3, y:.69, px:.001};
  resize();

  // t in ms from the start of the globe's part. Pure function of time, so a skip just draws the last frame.
  // Three beats on one clock: the ball is presented under the title (it eases from 27 to 30% of the screen and
  // squares up to us), the camera dives onto Home on a log-distance curve, then the view glides up 24 px to
  // frame the plaza above the buttons. Distances come from the wanted on-screen size, so it fits any screen.
  const T = {present:2050, diveEnd:3750, total:3950};   // a slow dive still pushing in while the blast happens; only the zoom continues after the hit   // no drifting on after the hit; it glides into the hit and comes to rest ~0.17 s later under the blast   // slower, and still moving when the feather hits; it settles under the blast   // the dive a little slower (0.6 -> 0.78 s), the hit stays at 2.3 s   // the camera holds until the feather starts its final drop, then dives with it   // the camera lands as the feather touches down
  const total = T.total, settle = bezier(.37, 0, .63, 1), glide = bezier(.23, 1, .32, 1);
  const tanH = Math.tan(FOV * Math.PI / 360);
  const distFor = frac => 1 / Math.sin(Math.atan(frac * tanH));   // camera distance that shows the ball at frac of the height
  // the dive: one smooth curve from the hold to the landing
  const dive = q => q * q * q * (q * (6 * q - 15) + 10);   // one smooth curve: eases out of the hold, fastest mid-dive, eases into the landing
  const progress = t => dive(clamp01((t - T.present) / (T.diveEnd - T.present)));
  // The feather's flight, a pure function of time like the camera. While the title is up it flies in from the left
  // across the sky above the planet, a little ahead of the camera, rises past the title, banks through a loop on the
  // right and comes back to the middle; as the dive starts it leads the camera down onto Home and lands there at the
  // cloud punch with a small golden burst. It banks and twists around its own shaft all the way (a card in 3D).
  const FEATHER_IN = 640;   // globe clock: just after the opening clouds have cleared
  const F = {orbitEnd:2050, land:2950, burstEnd:3250, ahead:.55};
  // [ms, x, y] on screen (-1 left .. 1 right, -1 bottom .. 1 top): up over the title, round the right side, back under it
  // the whole flight, start to touchdown, as drawn in the feather path editor. The last point is
  // pinned at runtime to wherever Home sits on screen at the touchdown, so it lands true on every screen shape.
  // centripetal Catmull-Rom: no cusps, no loops, rounds every corner (the same function as the path editor)
  // The flight is smooth in two ways. Shape: a centripetal Catmull-Rom curve through the points (no cusps, no
  // loops). Speed: the distance travelled along that curve is a monotone cubic through each point's time, so the
  // speed changes smoothly through every point instead of jumping from one stretch to the next.
  let flight = null;
  function buildFlight() {
    const P = PATH, n = P.length, v = p => [p[1], p[2] * 9 / 16];
    const at = (i, u) => {
      const Q = k => P[Math.max(0, Math.min(n - 1, k))], p0 = Q(i - 1), p1 = Q(i), p2 = Q(i + 1), p3 = Q(i + 2);
      const d = (a, b) => Math.max(1e-4, Math.hypot(v(a)[0] - v(b)[0], v(a)[1] - v(b)[1]) ** .5);
      const t0 = 0, t1 = d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3), tt = t1 + (t2 - t1) * u;
      const L = (a, b, ta, tb) => [1, 2].map(j => ((tb - tt) * a[j] + (tt - ta) * b[j]) / (tb - ta));
      const A1 = L(p0, p1, t0, t1), A2 = L(p1, p2, t1, t2), A3 = L(p2, p3, t2, t3);
      const B1 = [0, 1].map(j => ((t2 - tt) * A1[j] + (tt - t0) * A2[j]) / (t2 - t0)), B2 = [0, 1].map(j => ((t3 - tt) * A2[j] + (tt - t1) * A3[j]) / (t3 - t1));
      return [0, 1].map(j => ((t2 - tt) * B1[j] + (tt - t1) * B2[j]) / (t2 - t1));
    };
    const pts = [], len = [0], knot = [0];
    for (let i = 0; i < n - 1; i++) for (let k = i ? 1 : 0; k <= 48; k++) {
      const q = at(i, k / 48);
      if (pts.length) {const p = pts[pts.length - 1]; len.push(len[len.length - 1] + Math.hypot(q[0] - p[0], (q[1] - p[1]) * 9 / 16));}
      pts.push(q);
      if (k === 48) knot.push(len[len.length - 1]);
    }
    // Fritsch-Carlson slopes: a smooth, never-backwards distance-for-time curve through the points' times
    const T = P.map(p => p[0]), S = knot, m = T.map(() => 0), dl = T.slice(0, -1).map((_, i) => (S[i + 1] - S[i]) / (T[i + 1] - T[i]));
    for (let i = 1; i < n - 1; i++) m[i] = dl[i - 1] * dl[i] <= 0 ? 0 : 3 * (dl[i - 1] + dl[i]) / ((2 * dl[i] + dl[i - 1]) / dl[i - 1] + (dl[i] + 2 * dl[i - 1]) / dl[i]);
    m[0] = dl[0]; m[n - 1] = dl[n - 2];
    flight = {pts, len, T, S, m};
  }
  function screenAt(t) {
    if (!touchdown) {camAt(F.land); const h = homeAt(F.land).project(camera); touchdown = [h.x, h.y]; flight = null;}
    PATH[PATH.length - 1][1] = touchdown[0]; PATH[PATH.length - 1][2] = touchdown[1];
    if (!flight) buildFlight();
    const {pts, len, T, S, m} = flight;
    let i = 0;
    while (i < T.length - 2 && t > T[i + 1]) i++;
    const h = T[i + 1] - T[i], u = clamp01((t - T[i]) / h);
    const dist = (2 * u ** 3 - 3 * u ** 2 + 1) * S[i] + (u ** 3 - 2 * u ** 2 + u) * h * m[i] + (-2 * u ** 3 + 3 * u ** 2) * S[i + 1] + (u ** 3 - u ** 2) * h * m[i + 1];
    let lo = 0, hi = len.length - 1;
    while (hi - lo > 1) {const mid = (lo + hi) >> 1; if (len[mid] < dist) lo = mid; else hi = mid;}
    const f = clamp01((dist - len[lo]) / ((len[hi] - len[lo]) || 1));
    return [0, 1].map(j => pts[lo][j] + (pts[hi][j] - pts[lo][j]) * f);
  }
  // the ball's turn at time t (the same numbers draw() uses), so Home's spot is known at any moment
  const rotAt = t => [-.5 * (1 - easeInOut(clamp01((t - 1500) / 1450))), 2.4 * (1 - easeOut(clamp01(t / 2950)))];   // both turns run the full dive, so nothing stops mid-way   // the world rolls a long way round before Home settles in the middle
  const homeAt = t => {const [x, y] = rotAt(t); return new THREE.Vector3(0, 0, 1.03).applyEuler(new THREE.Euler(x, y, 0));};
  const ndc = new THREE.Vector3();
  function featherAt(t) {
    t = Math.min(t, F.land);
    camAt(t);
    const [x, y] = screenAt(t);
    const dir = ndc.set(x, y, .5).unproject(camera).sub(camera.position).normalize();
    // just ahead of the camera all the way; over the dive it stays big and close, sinking to the ground only at the end
    const k = clamp01((t - F.orbitEnd) / (F.land - F.orbitEnd));
    const toHome = camera.position.distanceTo(homeAt(t)), near = F.ahead + (Math.min(F.ahead, .3 * toHome) - F.ahead) * k * k * (3 - 2 * k);   // always in front of the ground, so it reads big and close
    const depth = near + (toHome - near) * k ** 4;   // and hits the land at the end, never sinks into it
    return camera.position.clone().addScaledVector(dir, depth);
  }
  // world size that keeps a card at most `frac` of the screen height, wherever the camera is
  const capSize = (pos, size, frac) => Math.min(size, frac * 2 * camera.position.distanceTo(pos) * tanH);
  const DIAG = new THREE.Vector3(1, 1, 0).normalize(), CROSS = new THREE.Vector3(-1, 1, 0).normalize();   // the art's shaft runs bottom-left to top-right
  const toScreen = v => v.clone().project(camera);
  function placeFeather(t) {
    const live = t < F.land, tc = Math.min(t, F.land);
    const p = featherAt(tc), ahead = featherAt(Math.min(tc + 24, F.land + 24));
    // sparkle i was born at a moment on a fixed 26 ms grid, so each one stays put in the world once it is born
    const born = trail.map((_, i) => Math.floor(t / TRAIL_GAP) * TRAIL_GAP - i * TRAIL_GAP);
    const past = born.map(tb => tb > FEATHER_IN && tb < F.land ? featherAt(tb) : null);
    camAt(t);
    const shrink = t < F.land + 40 ? 1 : 0;   // it hits and is gone in the blast
    featherSp.visible = (live || shrink > 0) && t > FEATHER_IN;
    featherSp.position.copy(p);
    // the feather enters once the clouds have cleared, with a small pop, so the globe gets its moment first
    const e = clamp01((t - FEATHER_IN) / 220), enter = e >= 1 ? 1 : 1 + 2.2 * (e - 1) ** 3 + 1.2 * (e - 1) ** 2;
    const s = capSize(p, .85, .13 * Math.min(1, camera.aspect / .8)) * Math.max(.05, shrink);   // on a tall phone, sized by width too
    featherSp.scale.set(s * enter, s * enter, 1);
    // face the camera, point along the way it is flying, then bank around the shaft and pitch a little
    const end = tc > F.land - 24, a = toScreen(end ? featherAt(tc - 24) : p), b = toScreen(end ? p : ahead), heading = Math.atan2(b.y - a.y, (b.x - a.x) * camera.aspect);   // at touchdown it keeps the angle it came in at (no last-frame flip)
    featherSp.quaternion.copy(camera.quaternion);
    featherSp.rotateZ(heading - Math.PI / 4);
    const flutter = t <= F.orbitEnd ? 1 : 1.8;
    featherSp.rotateOnAxis(DIAG, .85 * Math.sin(t / 260 * flutter));
    featherSp.rotateOnAxis(CROSS, .22 * Math.sin(t / 410 + 1));
    // the trail flows: each glint is born on the path, a little off the line, then drifts back and down like
    // chimes settling, twinkling and turning, growing in fast and shrinking away (never a fade)
    trail.forEach((sp, i) => {
      const q = past[i], tb = born[i], age = (t - tb) / TRAIL_LIFE;
      sp.visible = !!q && age < 1 && t < F.land + 260;
      if (!sp.visible) return;
      const id = Math.round(tb / TRAIL_GAP), r1 = hash(id), r2 = hash(id + 17), r3 = hash(id + 41);
      const side = (r1 - .5) * 2, drift = .008 + .05 * age;
      const off = new THREE.Vector3(side * drift, (r2 - .5) * drift - .06 * age * age, 0).applyQuaternion(camera.quaternion).multiplyScalar(camera.position.distanceTo(q) * .5);
      sp.position.copy(q).add(off);
      const twinkle = .6 + .4 * Math.sin(t / 45 + id * 2.3), grow = Math.min(1, age * 9) * (1 - age) ** 1.2;
      const ds = capSize(q, .4, .075 * Math.min(1, camera.aspect / .8)) * (.35 + 1.0 * r3) * (id % 3 ? 1.15 : .7) * twinkle * grow;
      sp.material.color.copy(id % 3 === 0 ? WHITE : id % 3 === 1 ? GOLD : PALE);
      sp.scale.set(ds, ds, 1);
      sp.material.rotation = id * .9 + t / 600 * (r1 > .5 ? 1 : -1);
    });
    const home = homeAt(t), bb = clamp01((t - F.land) / (F.burstEnd - F.land));
    burst.visible = false;
    burst.position.copy(home);
    const bs = capSize(home, .4, .6) * (.2 + 1.2 * easeOut(bb));
    burst.scale.set(bs, bs, 1);
    burst.material.opacity = 1 - bb;
  }
  const smooth01 = x => {const k = clamp01(x); return k * k * (3 - 2 * k);};
  // the move for the horizon: the planet rises from below the bottom edge as the title lands, turning as it
  // comes so Home rolls in from the right to the middle; then the camera tips over the horizon and drops onto Home
  const rise = bezier(.2, .8, .25, 1);
  // the camera at time t; the feather's path asks for other moments too, so this is a pure function of t
  function camAt(t) {
    const z = progress(t), g = glide(clamp01((t - T.diveEnd) / (T.total - T.diveEnd))), up = rise(clamp01(t / 1500));
    const near = distFor(look.diam) * (1 - .07 * easeInOut(clamp01(t / 3750)));   // a slow push-in that runs on under the dive, so the hand-off into it never goes slack
    const d = 1 + Math.exp(Math.log(near - 1) + (Math.log(end - 1) - Math.log(near - 1)) * z);
    camera.position.set(0, 0, d);
    // the subject's height on screen: the ball centre at look.y, then Home higher up (+24 px until the glide)
    const yEnd = .2 + 24 * look.px * (1 - g);
    const yStart = look.y + .55 * (1 - up);   // starts low, the horizon near the bottom edge
    const yc = yStart + (yEnd - yStart) * easeInOut(clamp01(z));
    const depth = d - z;   // from the ball's centre at first to Home's surface by the end
    camera.lookAt(0, (yc - .5) * 2 * depth * tanH, 0);   // looking above the subject puts it lower on screen
    camera.updateMatrixWorld();
    return z;
  }
  function draw(t) {
    lastT = t; drawing = true;
    if (t >= OPENED && opened) {opened(); opened = null;}
    const tc = Math.min(t, total);
    [globe.rotation.x, globe.rotation.y] = rotAt(tc);
    placeFeather(tc);
    const z = camAt(tc);
    // the globe's clouds: none behind the title on phones,
    // and none of the near clouds that came in during the dive
    sky.forEach(sp => {sp.visible = !isPhone; const {x, y, z, drift} = sp.userData; sp.position.set(x - drift * t / 1000, y, z);});   // group 4: one slow, steady drift (no bob: it read as back and forth)
    const fadeOut = 1 - smooth01((z - .25) / .65);   // the planet's cloud layer and rim thin out over most of the dive, never in one gulp
    halo.material.uniforms.k.value = rim.material.uniforms.k.value = clouds.material.uniforms.k.value = fadeOut;
    clouds.material.uniforms.phase.value = t / 1000 * .06;   // the cloud layer drifts over the sea
    halo.material.uniforms.c.value.set(0, 0, 0).applyMatrix4(camera.matrixWorldInverse);
    halo.material.uniforms.w.value = 7 * 2 * camera.position.length() * tanH / height;   // 7 px at the ball's distance
    for (const sp of billboards) {
      const {dive, i, lat, r} = sp.userData;
      // fewer clouds in the centre (the 4 middle horizon ones). The four near-Home clouds are phone-only (the
      // phone's dive had no clouds at all); they sit on the ball either side of Home, riding it like the rest
      sp.visible = !(i >= 2 && i <= 5) && (!dive || isPhone);
      // every cloud on the ball drifts, one slow steady way (the way the ball turns), never back
      const lon = (dive ? NEAR_HOME[i - 12][0] * (1 + 2.5 * smooth01((z - .5) / .4)) : sp.userData.lon) - tc / 1000 * .1, la = dive ? NEAR_HOME[i - 12][1] : lat;
      sp.position.set(Math.sin(lon) * Math.cos(la) * r, Math.sin(la) * r, Math.cos(lon) * Math.cos(la) * r);
      sp.getWorldPosition(tmp);
      // round the back of the ball it is not drawn; coming over the horizon it grows up from it (no fade, no cut)
      const rise = smooth01((tmp.dot(camera.position) / (tmp.length() * camera.position.length()) + .3) / .25);
      if (rise <= 0) sp.visible = false;
      sp.scale.copy(sp.userData.base).multiplyScalar(rise);
      sp.material.opacity = dive ? 1 : clamp01((camera.position.distanceTo(tmp) - .1) / .15);   // the phone's near-Home clouds stay solid as they pass
    }
    renderer.render(scene, camera);
  }
  const tmp = new THREE.Vector3();
  const homeOnScreen = t => {camAt(t); [globe.rotation.x, globe.rotation.y] = rotAt(t); globe.updateMatrixWorld(); const p = homeAt(t).project(camera); return [(p.x + 1) / 2 * width, (1 - p.y) / 2 * height];};
  renderer.compile(scene, camera);   // build every shader now, not on the first frame of the intro
  let lastT = 0;
  // the end screen is always the last frame of the intro, so it never depends on which frame a hidden tab last drew
  const still = () => {renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); resize(); draw(Math.max(lastT, total));};
  return {total, draw, resize, still, progress, timing:T, land:F.land, homeOnScreen, homeReady, destroy() {renderer.dispose(); [skyTex, groundTex, propsTex, groundFull, skyFull, ...nearTex, ...cloudTex, featherTex, dotTex, starTex].forEach(x => x?.dispose());}};
}
