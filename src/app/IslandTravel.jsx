
import {useEffect, useState} from 'react';
import {MATERIAL_NAMES} from '../gameplay/boat-build.js';

const actionLabel = options => options.take ? 'Take boat' : options.dock ? 'Dock'
  : options.build ? 'Build boat' : options.collect ? `Pick up ${MATERIAL_NAMES[options.collect]}` : null;

const directions = [
  {name: 'north', x: 0, y: -1},
  {name: 'west', x: -1, y: 0},
  {name: 'east', x: 1, y: 0},
  {name: 'south', x: 0, y: 1},
];

export default function IslandTravel({travel,playing,room,island,notice}) {
  const sailing=playing && travel.mode==='sailing';
  const [options,setOptions]=useState({});
  useEffect(() => {
    if (!playing) {setOptions({}); return;}
    const id=setInterval(() => {
      const next=island.current?.travelOptions?.() ?? {};
      setOptions(prev => ['take','dock','collect','build'].every(key => prev[key] === next[key]) ? prev : next);
    }, 250);
    return () => clearInterval(id);
  }, [playing, island]);
  function steer(event,x,y) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    if (island.current) island.current.touchInput={x,y};
  }
  function stop() { island.current?.stopInput(); }
  const touch=typeof matchMedia==='function' && matchMedia('(pointer: coarse)').matches;
  return <>
    {notice && <p className="pixi-travel-notice" data-feather={/feather/i.test(notice) || undefined} role="status">{notice}</p>}
    {actionLabel(options) && <button className="pixi-travel-action" onClick={() => island.current?.travelAction()}>
      {actionLabel(options)} <kbd>Enter</kbd>
    </button>}
    {sailing && touch && <div className="pixi-steering" role="group" aria-label="Boat steering">
      <span className="pixi-steering-compass" aria-hidden="true"/>
      {directions.map(({name,x,y}) =>
        <button key={name} type="button" data-direction={name} aria-label={`Steer ${name}`}
          onPointerDown={event => steer(event,x,y)}
          onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}
          onKeyDown={event => {if ([' ','Enter'].includes(event.key)) {event.preventDefault(); if (island.current) island.current.touchInput={x,y};}}}
          onKeyUp={stop} onBlur={stop}/>)}
    </div>}
  </>;
}
