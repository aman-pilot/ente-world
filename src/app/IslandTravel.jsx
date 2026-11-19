
import {useEffect, useRef, useState} from 'react';
import {MATERIAL_NAMES} from '../gameplay/boat-build.js';
import {ISLANDS} from '../gameplay/islands.js';
import {TELEPORTERS, teleportPrice} from '../gameplay/teleport.js';

const actionLabel = options => options.teleport ? 'Use teleporter' : options.take ? 'Take boat' : options.dock ? 'Dock'
  : options.build ? 'Build boat' : options.collect ? `Pick up ${MATERIAL_NAMES[options.collect]}` : null;

const directions = [
  {name: 'north', x: 0, y: -1},
  {name: 'west', x: -1, y: 0},
  {name: 'east', x: 1, y: 0},
  {name: 'south', x: 0, y: 1},
];

function DestinationPicker({source, balance, pending, notice, onClose, onConfirm}) {
  const [destination,setDestination]=useState('');
  const close=useRef(null);
  useEffect(() => {close.current?.focus();}, []);
  const price=destination ? teleportPrice(destination) : 0;
  const feather = <img className="pixi-teleporter-feather" src="/pixi-art/karma/golden-feather.svg" alt="" draggable="false"/>;
  return <section className="pixi-teleporter" role="dialog" aria-labelledby="teleporter-title"
    onKeyDown={event => {if (event.key === 'Escape') {event.preventDefault(); onClose();}}}>
    <header>
      <h2 id="teleporter-title">Island teleporter</h2>
      <button ref={close} type="button" className="pixi-teleporter-close" aria-label="Close teleporter" onClick={onClose}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
      </button>
    </header>
    <p className="pixi-teleporter-balance">You have <b>{balance}</b>{feather}<span className="pixi-sr">golden {balance === 1 ? 'feather' : 'feathers'}</span></p>
    <form onSubmit={event => {
      event.preventDefault();
      if (destination && balance >= price && !pending) onConfirm(destination);
    }}>
      <fieldset disabled={pending}>
        <legend>Where to?</legend>
        {ISLANDS.filter(({id}) => id !== source && TELEPORTERS.has(id)).map(({id,name,accent}) => {
          const cost=teleportPrice(id), short=cost-balance;
          return <label key={id} data-short={short > 0 || undefined}>
            <input type="radio" name="destination" value={id} checked={destination === id} onChange={() => setDestination(id)}/>
            <i className="pixi-teleporter-dot" style={{background:`#${(accent ?? 0xffda69).toString(16).padStart(6,'0')}`}} aria-hidden="true"/>
            <span><strong>{name}</strong>{short > 0 && <small>Need {short} more</small>}</span>
            <span className="pixi-teleporter-cost">{cost}{feather}<span className="pixi-sr">feathers</span></span>
          </label>;
        })}
      </fieldset>
      {notice && <p role="status" className="pixi-teleporter-notice">{notice}</p>}
      <button className="pixi-teleporter-confirm" disabled={!destination || balance < price || pending}>
        {pending ? 'Teleporting…' : destination ? <>Teleport for {price}{feather}</> : 'Pick an island'}
      </button>
    </form>
  </section>;
}

export default function IslandTravel({travel,playing,room,island,notice,teleportSource,setTeleportSource}) {
  const sailing=playing && travel.mode==='sailing';
  const [options,setOptions]=useState({});
  const [balance,setBalance]=useState(0);
  const [pending,setPending]=useState(null);
  const open=Boolean(playing && teleportSource === travel.islandId);
  useEffect(() => {
    if (!playing) {setOptions({}); setPending(null); return;}
    function update() {
      const next=island.current?.travelOptions?.() ?? {};
      setOptions(prev => ['take','dock','collect','build','teleport'].every(key => prev[key] === next[key]) ? prev : next);
      if (teleportSource && (!next.teleport || island.current?.islandId !== teleportSource)) setTeleportSource(null);
      if (teleportSource) setBalance(room.current?.karma ?? 0);
      if (pending && !room.current?.pending.some(command => command.seq === pending)) setPending(null);
    }
    update();
    const id=setInterval(update, 250);
    return () => clearInterval(id);
  }, [playing, island, room, pending, teleportSource, setTeleportSource]);
  useEffect(() => {
    if (teleportSource && (!playing || teleportSource !== travel.islandId)) setTeleportSource(null);
  }, [playing, teleportSource, travel.islandId, setTeleportSource]);
  function steer(event,x,y) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    if (island.current) island.current.touchInput={x,y};
  }
  function stop() { island.current?.stopInput(); }
  const touch=typeof matchMedia==='function' && matchMedia('(pointer: coarse)').matches;
  return <>
    {!open && notice && <p className="pixi-travel-notice" data-feather={/feather/i.test(notice) || undefined} role="status">{notice}</p>}
    {!open && actionLabel(options) && <button className="pixi-travel-action" data-teleporter={options.teleport || undefined} onClick={() => island.current?.travelAction()}>
      {actionLabel(options)} <kbd>Enter</kbd>
    </button>}
    {open && <DestinationPicker key={teleportSource} source={teleportSource} balance={balance} pending={Boolean(pending)} notice={notice}
      onClose={() => setTeleportSource(null)} onConfirm={destination => {
        if (island.current?.islandId !== teleportSource || !island.current?.travelOptions().teleport) {
          setTeleportSource(null);
          return;
        }
        const seq=room.current?.teleport(destination);
        if (seq) setPending(seq);
      }}/>}
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
