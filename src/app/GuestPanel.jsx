import {useEffect, useRef, useState} from 'react';
import './guest-panel.css';
import {warmSignInCache} from './home-head-start.js';

function GithubMark() {
  return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .8a11.2 11.2 0 0 0-3.54 21.83c.56.1.77-.24.77-.54v-2.08c-3.13.68-3.79-1.33-3.79-1.33-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.68.08-.68 1.13.08 1.73 1.16 1.73 1.16 1 1.72 2.63 1.22 3.27.94.1-.73.4-1.22.71-1.5-2.5-.28-5.13-1.25-5.13-5.57 0-1.23.44-2.23 1.16-3.02-.12-.28-.5-1.43.11-2.98 0 0 .95-.3 3.08 1.15a10.7 10.7 0 0 1 5.6 0c2.14-1.45 3.08-1.15 3.08-1.15.61 1.55.23 2.7.12 2.98.72.79 1.15 1.79 1.15 3.02 0 4.33-2.63 5.28-5.14 5.56.4.35.76 1.03.76 2.08v3.07c0 .3.2.65.77.54A11.2 11.2 0 0 0 12 .8Z"/></svg>;
}

// remembered for the trip to GitHub and back, so the island opens with the clouds-part arrival (ArrivalClouds.jsx)
const markArrival = () => {try {sessionStorage.setItem('ew-arrive', '1');} catch {/* ignore */}};

export default function GuestPanel({signInAvailable, onWatch, plain = false}) {
  const [leaving, setLeaving] = useState(false);
  const duck = useRef(null);
  const face = useRef(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  // Ducky blinks at uneven gaps: eyes squash to 0.1 and back, closing faster than opening.
  useEffect(() => {
    let timer;
    const blink = () => face.current?.querySelectorAll('.guest-eye').forEach(eye => eye.animate(
      [{transform:'scaleY(1)'}, {transform:'scaleY(.1)', offset:.35}, {transform:'scaleY(1)'}],
      {duration:200, easing:'cubic-bezier(.45,0,.55,1)'}));
    const next = () => {timer = setTimeout(() => {
      blink();
      if (Math.random() < .2) setTimeout(blink, 260);
      next();
    }, 3000 + Math.random() * 3000);};
    // the first blink is in the entrance itself (CSS, at 1.2 s); the landing's end screen has no CSS entrance, so it blinks once here
    timer = setTimeout(() => {if (plain) blink(); next();}, 1400);
    return () => clearTimeout(timer);
  }, [plain]);
  // Ducky looks toward the pointer on springs, so every move eases in and out: eyes and beak lead,
  // the body leans 65 ms later, hands stay planted on the button.
  useEffect(() => {
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let want = {x:0, y:0}, frame, last = performance.now();
    const history = [], spring = () => ({x:0, v:0});
    const fx = spring(), fy = spring(), bx = spring();
    const step = (s, to, k, c, dt) => {s.v += (k * (to - s.x) - c * s.v) * dt; s.x += s.v * dt;};
    function move(event) {
      const box = duck.current?.getBoundingClientRect();
      if (!box) return;
      want = {
        x:Math.max(-1, Math.min(1, (event.clientX - box.x - box.width / 2) / (innerWidth / 2))),
        y:Math.max(-1, Math.min(1, (event.clientY - box.y - box.height / 2) / (innerHeight / 2))),
      };
    }
    function leave() {want = {x:0, y:0};}
    function tick(now) {
      const dt = Math.min(1 / 30, (now - last) / 1000); last = now;
      history.push({t:now, x:want.x});
      while (history.length > 2 && history[1].t <= now - 65) history.shift();
      step(fx, want.x, 70, 15, dt);
      step(fy, want.y, 70, 15, dt);
      step(bx, history[0].x, 50, 13, dt);
      if (face.current) face.current.style.transform = `translate3d(${(fx.x * 6).toFixed(3)}px, ${(fy.x * 4).toFixed(3)}px, 0)`;
      if (duck.current) duck.current.style.transform = `skewX(${(-bx.x * 3).toFixed(3)}deg) translateZ(0)`;
      frame = requestAnimationFrame(tick);
    }
    window.addEventListener('pointermove', move);
    document.documentElement.addEventListener('pointerleave', leave);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', move);
      document.documentElement.removeEventListener('pointerleave', leave);
    };
  }, []);
  function watch() {
    if (leaving) return;
    setLeaving(true);
    timer.current = setTimeout(onWatch, plain || window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 200);   // the landing: its clouds close in at once
  }
  // the landing: the cover closes in over the end screen first (the same clouds that open on the way back), then it leaves for GitHub
  const goWithClouds = event => {
    warmSignInCache();
    markArrival();
    const href = event.currentTarget.getAttribute('href');
    if (!plain || !href || !window.EWArrival?.mount || event.metaKey || event.ctrlKey || event.shiftKey || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    event.preventDefault(); setLeaving(true);
    window.EWArrival.mount('close', '');
    setTimeout(() => location.assign(href), 760);
  };
  const auth = {href:signInAvailable ? '/auth/github/start' : undefined, 'aria-disabled':!signInAvailable, onClick:goWithClouds};
  return <aside className="guest-panel" aria-labelledby="guest-title" data-leaving={leaving} data-plain={plain || undefined}>
    <div className="guest-stack">
      <h1 id="guest-title" className="guest-title">Ente World</h1>
      <div className="guest-action">
        <div className="guest-duck-rise" aria-hidden="true"><div className="guest-duck" ref={duck}>
          <img src="/guest/ducky-peek-body.webp" width="1024" height="640" alt=""/>
          <div className="guest-face" ref={face}>
            <img className="guest-beak" src="/guest/ducky-peek-beak.webp" width="176" height="89" alt=""/>
            <span className="guest-eye guest-eye-left"/><span className="guest-eye guest-eye-right"/>
          </div>
        </div></div>
        <div className="guest-duck-rise guest-duck-wings" aria-hidden="true"><div className="guest-wings">
          <img src="/guest/ducky-peek-wings.webp" width="1024" height="640" alt=""/>
        </div></div>
        <a {...auth} className="guest-play"><GithubMark/>Play with GitHub</a>
      </div>
      <div className="guest-secondary">
        <button className="guest-watch" type="button" onClick={watch}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>Watch as a guest</button>
      </div>
    </div>
  </aside>;
}
