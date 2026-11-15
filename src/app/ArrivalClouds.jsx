import {useEffect, useLayoutEffect, useRef, useState} from 'react';
// styles: index.html (#arrival-css), so the page can draw this cover before any code loads

// Back from GitHub sign-in: the intro's clouds cover the screen while the island loads, part when it is drawn,
// then a "Hi, @login" tag with the GitHub photo pops up where the duck stands and lifts away.
import {ARRIVE_KEY} from './arrival.js';

// a solid bank: big plain-white clouds packed over a pale inside-the-cloud fill, so nothing shows through while it covers
const CLOUDS = window.EWArrival?.clouds || [[1, 'l', -34], [2, 'r', -30], [3, 'l', 0], [4, 'r', 4], [5, 'l', 34], [6, 'r', 38], [7, 'b', 60], [8, 'b', 92]];

export default function ArrivalClouds({drawn, login, onDone}) {
  const [phase, setPhase] = useState('cover');   // cover -> part (the tag pops as the clouds clear) -> gone
  const done = useRef(onDone); done.current = onDone;
  const name = useRef(login); name.current = login;
  const root = useRef(null);
  useEffect(() => {try {sessionStorage.removeItem(ARRIVE_KEY);} catch {/* ignore */}}, []);
  // the page drew this same cover on its first frame (index.html); carry on from where its clocks are, so the swap
  // (PixiPage removes the page's copy) shows nothing at all
  useLayoutEffect(() => {
    const t0 = window.EWArrival?.t0;
    if (t0 == null || !root.current) return;
    const ahead = performance.now() - t0;
    root.current.getAnimations({subtree:true}).forEach(a => {a.currentTime = (a.currentTime || 0) + ahead;});
  }, []);
  useEffect(() => {
    if (!drawn || phase !== 'cover') return;
    setPhase('part');
  }, [drawn, phase]);
  // never hold the player behind the clouds forever: part after 30 s even if the island has not reported it is drawn
  // (12 s parted onto an empty sea on slow 4G, where Home took longer than that to draw)
  useEffect(() => {const cap = setTimeout(() => setPhase(p => p === 'cover' ? 'part' : p), 30000); return () => clearTimeout(cap);}, []);
  // the tag came 0.6 s after the clouds had gone; now it pops 0.9 s into the parting, as they clear
  // (arrival.css), and the whole thing ends once it has lifted away
  useEffect(() => {
    if (phase !== 'part') return;
    const a = setTimeout(() => setPhase('gone'), name.current ? 3750 : 1700);
    return () => clearTimeout(a);
  }, [phase]);
  useEffect(() => {if (phase === 'gone') done.current?.();}, [phase]);   // the star box waits until the tag has gone
  if (phase === 'gone') return null;
  return <div className="arrival" data-phase={phase} ref={root}>
    <div className="arrival-sky" aria-hidden="true"/>
    {CLOUDS.map(([art, side, y], i) => <img key={i} className="arrival-cloud" data-side={side} style={{'--y':`${y}vh`, '--i':i}}
      src={window.EWClouds?.url(art, true)} alt="" aria-hidden="true"/>)}
    {/* a still white cover read as a broken page; the clouds drift and the golden feather floats while the island loads */}
    <div className="arrival-loader" role="status" aria-label="Loading your island" dangerouslySetInnerHTML={{__html:window.EWArrival?.loader?.(window.EWArrival.guest ? 'Flying to Home' : 'Landing on your island') || ''}}/>
    {phase === 'part' && login && <div className="arrival-tag" role="status">
      <img className="arrival-avatar" src={`https://github.com/${encodeURIComponent(login)}.png?size=96`} width="48" height="48" alt=""/>
      Hi, <b>@{login}</b>
    </div>}
  </div>;
}
