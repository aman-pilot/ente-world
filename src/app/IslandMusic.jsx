import {useEffect, useRef, useState} from 'react';
import './island-music.css';

const tracks = [
  ['then','Then','Vishnu'], ['sublime','Sublime','Ashil'],
  ['love','Love','Vishnu'], ['love-reprise','Love (Reprise)','Vishnu'],
  ['home','Home','aspizu'], ['sunday','Sunday','Vishnu'],
  ['get-better','Get Better','Luke Iggy'], ['discovery','Discovery','Vinay Krishnan'],
];
const trackUrl = index => `https://music.ente.com/tracks/${tracks[index][0]}.mp3`;

export default function IslandMusic({island}) {
  const host = useRef(null), audio = useRef(null), spectrum = useRef(null);
  const graph = useRef(null), request = useRef(0);
  const [track,setTrack] = useState(0);
  const [state,setState] = useState('idle');
  const active = state === 'playing' || state === 'loading';

  useEffect(() => {
    const player = audio.current;
    player.src = trackUrl(0);
    player.volume = .35;
    return () => {
      request.current++;
      if (!graph.current) return;
      player.pause();
      player.removeAttribute('src');
      player.load();
      graph.current.context.close().catch(() => {});
      graph.current = null;
    };
  }, []);

  useEffect(() => {
    const live = host.current.parentElement.querySelector('.pixi-live');
    if (!live || typeof ResizeObserver === 'undefined') return;
    const element = host.current;
    function place() {
      element.style.marginTop = '';
      const hud = live.getBoundingClientRect(), player = element.getBoundingClientRect();
      if (hud.left < player.right && hud.right > player.left && hud.bottom > player.top) {
        element.style.marginTop = `${hud.bottom-player.top+12}px`;
      }
    }
    const observer = new ResizeObserver(place);
    observer.observe(live);
    window.addEventListener('resize',place);
    return () => {observer.disconnect();window.removeEventListener('resize',place);};
  });

  useEffect(() => {
    const bars = [...spectrum.current.children];
    if (state !== 'playing') {
      for (const bar of bars) bar.style.transform = 'scaleY(.04)';
      return;
    }
    let frame, last = 0;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const {analyser} = graph.current;
    const data = new Uint8Array(analyser.frequencyBinCount);
    function draw(time) {
      if (time-last > (reduced ? 400 : 50)) {
        analyser.getByteFrequencyData(data);
        bars.forEach((bar,i) => {
          const bin = Math.floor((i/bars.length)**1.6 * (data.length-1));
          bar.style.transform = `scaleY(${Math.max(.04,data[bin]/255)})`;
        });
        last = time;
      }
      frame = requestAnimationFrame(draw);
    }
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [state]);

  async function start() {
    const id = ++request.current;
    setState('loading');
    try {
      if (!graph.current) {
        const context = new AudioContext(), analyser = context.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = .8;
        context.createMediaElementSource(audio.current).connect(analyser);
        analyser.connect(context.destination);
        graph.current = {context,analyser};
      }
      await graph.current.context.resume();
      if (id !== request.current) return;
      await audio.current.play();
      if (id === request.current) setState('playing');
    } catch {
      if (id === request.current) setState('error');
    }
  }

  function pause() {
    request.current++;
    audio.current.pause();
    setState('paused');
  }

  function choose(index) {
    pause();
    const next = (index+tracks.length)%tracks.length;
    setTrack(next);
    audio.current.src = trackUrl(next);
    start();
  }

  return <section ref={host} className="pixi-music" aria-label="Ente music player"
    onPointerDown={() => island.current?.stopInput()} onKeyDown={event => event.stopPropagation()}>
    <div className="pixi-music-spectrum" ref={spectrum} role="img" aria-label="Live music frequency spectrum">
      {Array.from({length:24},(_,i) => <span key={i}/>)}
    </div>
    <div className="pixi-music-controls">
      <button aria-label="Previous song" onClick={() => choose(track-1)}>‹</button>
      <button className="pixi-music-play" onClick={active ? pause : start} aria-label={active ? 'Pause music' : 'Play music'}>{active ? 'Pause' : 'Play'}</button>
      <button aria-label="Next song" onClick={() => choose(track+1)}>›</button>
      <select aria-label="Music track" value={track} onChange={event => choose(Number(event.target.value))}>
        {tracks.map((song,i) => <option key={song[0]} value={i}>{song[1]} · {song[2]}</option>)}
      </select>
    </div>
    <div className="pixi-music-footer">
      <a href="https://music.ente.com/" target="_blank" rel="noreferrer">Music from Ente ↗</a>
      <label>Volume <input type="range" aria-label="Music volume" min="0" max="1" step=".01" defaultValue=".35" onChange={event => {audio.current.volume=Number(event.target.value);}}/></label>
    </div>
    <span className="pixi-music-status" role="status">{state === 'error' ? 'Could not load music. Press Play to retry.' : state === 'loading' ? 'Loading music…' : ''}</span>
    <audio ref={audio} src={trackUrl(0)} crossOrigin="anonymous" preload="none"
      onEnded={() => choose(track+1)} onError={() => {request.current++;setState('error');}}
      onWaiting={() => {if(!audio.current.paused)setState('loading');}}
      onPlaying={() => setState('playing')}/>
  </section>;
}
