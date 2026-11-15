import {useEffect, useState} from 'react';
// styles: index.html (#arrival-css), the same cloud bank and feather loader as the GitHub return

// The intro's clouds for the Bog's own waits: they close in with the feather and words, hold while the game gets
// ready, then part. `ready` parts them; they never hold longer than 15 s.
const CLOUDS = globalThis.window?.EWArrival?.clouds || [[1, 'l', -34], [2, 'r', -30], [3, 'l', 0], [4, 'r', 4], [5, 'l', 34], [6, 'r', 38], [7, 'b', 60], [8, 'b', 92]];

export default function BogClouds({text, ready, onGone}) {
  const [phase, setPhase] = useState('close');   // close (closing in, then holding) -> part -> gone
  // they always finish closing and show the feather for a moment, however fast the game is ready
  const [held, setHeld] = useState(false);
  useEffect(() => {const t = setTimeout(() => setHeld(true), 1400); return () => clearTimeout(t);}, []);
  useEffect(() => {if (ready && held && phase === 'close') setPhase('part');}, [ready, held, phase]);
  useEffect(() => {const cap = setTimeout(() => setPhase(p => p === 'close' ? 'part' : p), 15000); return () => clearTimeout(cap);}, []);
  useEffect(() => {
    if (phase !== 'part') return;
    const t = setTimeout(() => setPhase('gone'), 1700);
    return () => clearTimeout(t);
  }, [phase]);
  useEffect(() => {if (phase === 'gone') onGone?.();}, [phase]);
  if (phase === 'gone') return null;
  return <div className="arrival bog-clouds" data-phase={phase}>
    <div className="arrival-sky" aria-hidden="true"/>
    {CLOUDS.map(([art, side, y], i) => <img key={i} className="arrival-cloud" data-side={side} style={{'--y':`${y}vh`, '--i':i}}
      src={globalThis.window?.EWClouds?.url(art, true)} alt="" aria-hidden="true"/>)}
    <div className="arrival-loader" role="status" dangerouslySetInnerHTML={{__html:globalThis.window?.EWArrival?.loader?.(text) || ''}}/>
  </div>;
}

// the small feather loader for a line of status text (the ticket's "Connecting to the bog")
export function FeatherWait({text}) {
  return <span className="bog-wait" dangerouslySetInnerHTML={{__html:globalThis.window?.EWArrival?.loader?.(text) || text}}/>;
}
