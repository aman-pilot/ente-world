import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';

const {outputFiles:[bundle]} = await build({entryPoints:['src/app/IslandMusic.jsx'],bundle:true,
  packages:'external',jsx:'automatic',format:'esm',write:false,loader:{'.css':'empty'}});
const code = ['react','react/jsx-runtime'].reduce((text,name) =>
  text.replaceAll(JSON.stringify(name),JSON.stringify(import.meta.resolve(name))),bundle.text);
const {default:IslandMusic} = await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));

test('music starts on demand, cancels pending playback, advances and releases audio',async () => {
  const dom = new JSDOM('<div id="root"></div>');
  const keys = ['window','document','AudioContext','requestAnimationFrame','cancelAnimationFrame','IS_REACT_ACT_ENVIRONMENT'];
  const previous = Object.fromEntries(keys.map(key => [key,globalThis[key]]));
  let played=0, closed=0, stops=0, resume, sequence=0;
  const frames = new Map();
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true,
    requestAnimationFrame:fn => {const id=++sequence;frames.set(id,time=>{frames.delete(id);fn(time);});return id;},
    cancelAnimationFrame:id => frames.delete(id),
    AudioContext:class {
      constructor(){this.destination={};}
      createAnalyser(){return {connect(){},frequencyBinCount:128,getByteFrequencyData(data){data.fill(128);}};}
      createMediaElementSource(){return {connect(){}};}
      resume(){return new Promise(resolve => {resume=resolve;});}
      close(){closed++;return Promise.resolve();}
    },
  });
  window.matchMedia=()=>({matches:false});
  window.HTMLMediaElement.prototype.play=function(){played++;return Promise.resolve();};
  window.HTMLMediaElement.prototype.pause=function(){};
  window.HTMLMediaElement.prototype.load=function(){};
  const root=createRoot(document.getElementById('root'));
  try {
    await act(async()=>root.render(React.createElement(React.StrictMode,null,
      React.createElement(IslandMusic,{island:{current:{stopInput(){stops++;}}}}))));
    const player=document.querySelector('audio');
    assert.match(player.src,/\/then.mp3$/);
    assert.equal(player.volume,.35);
    assert.equal(played,0);
    assert.equal(document.querySelectorAll('option').length,8);
    document.querySelector('section').dispatchEvent(new window.Event('pointerdown',{bubbles:true}));
    assert.equal(stops,1);
    const options=document.querySelector('details');
    assert.equal(options.open,false,'secondary controls start collapsed');
    options.open=true;
    options.querySelector('select').dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    assert.equal(options.open,false,'Escape dismisses secondary controls');
    const click=label=>act(async()=>document.querySelector(`[aria-label="${label}"]`).click());
    await click('Play music');
    await click('Pause music');
    await act(async()=>resume());
    assert.equal(played,0,'pause cancels playback while the audio context is resuming');
    await click('Play music');
    await act(async()=>resume());
    assert.equal(played,1);
    frames.values().next().value(100);
    assert.match(document.querySelector('.pixi-music-spectrum span').style.transform,/0\.50/);
    await click('Next song');
    await act(async()=>resume());
    assert.match(player.src,/\/sublime.mp3$/);
    await act(async()=>player.dispatchEvent(new window.Event('ended')));
    await act(async()=>resume());
    assert.match(player.src,/\/love.mp3$/);
    await act(async()=>player.dispatchEvent(new window.Event('error')));
    assert.match(document.querySelector('[role="status"]').textContent,/retry/);
    assert.equal(frames.size,0);
  } finally {
    await act(async()=>root.unmount());
    assert.equal(closed,1);
    assert.equal(frames.size,0);
    dom.window.close();
    Object.assign(globalThis,previous);
  }
});
