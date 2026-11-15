import {arrivalPending} from './arrival.js';

// Keep the page-open session check for the game, without caching later refreshes.
let session;
export function startupSession() {
  return session ??= fetch('/api/session').then(r => {
    if (!r.ok) throw Error('Session request failed');
    return r.json();
  }).catch(error => {session=undefined; throw error;});
}

// Buffer the first snapshot while the renderer module downloads and evaluates.
// No player input is sent until RoomClient takes ownership.
let early;
export function startArrivalSocket() {
  if (early || !arrivalPending() || typeof WebSocket !== 'function') return;
  const url=new URL('/api/room?play=1',location.href);
  url.protocol=url.protocol==='https:'?'wss:':'ws:';
  const socket=new WebSocket(url), messages=[];
  const record=event=>messages.push(event);
  socket.addEventListener('message',record);
  early={socket,messages,record};
}
export function takeArrivalSocket() {
  const held=early; early=undefined;
  if (!held) return null;
  held.socket.removeEventListener('message',held.record);
  if (held.socket.readyState>1) {held.socket.close(); return null;}
  return held;
}
