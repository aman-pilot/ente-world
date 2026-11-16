import {useEffect, useRef, useState} from 'react';

const actionPaths = {
  download: <><path d="M12 4v10"/><path d="m7.5 10 4.5 4.5 4.5-4.5"/><path d="M5 15.5V18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2.5"/></>,
  share: <><path d="M12 14V4"/><path d="m8 7.5 4-4 4 4"/><path d="M8.5 10.5H7a2 2 0 0 0-2 2V18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5.5a2 2 0 0 0-2-2h-1.5"/></>,
  copy: <><rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M15.5 5.8V5a1.5 1.5 0 0 0-1.5-1.5H6A2.5 2.5 0 0 0 3.5 6v8a1.5 1.5 0 0 0 1.5 1.5h.8"/></>,
  close: <><path d="m7 7 10 10"/><path d="M17 7 7 17"/></>,
};

function ActionIcon({name}) {
  return <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    {actionPaths[name]}
  </svg>;
}

// The HUD button icon: an outline camera in the HUD ink.
function CameraIcon() {
  return <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9a2.5 2.5 0 0 1 2.5-2.5h1.8l1.4-2.2c.3-.5.8-.8 1.4-.8h3.8c.6 0 1.1.3 1.4.8l1.4 2.2h1.8A2.5 2.5 0 0 1 21 9v8.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/>
    <circle cx="12" cy="13" r="3.6"/>
    <path d="M17.5 9.8h.01" strokeWidth="2.4"/>
  </svg>;
}

function Polaroid({file, onClose}) {
  const dialog = useRef(null);
  const [url, setUrl] = useState('');
  const [printed, setPrinted] = useState(false);
  const [feedback, setFeedback] = useState('');
  const files = [file];
  const canShare = navigator.share && navigator.canShare?.({files});
  const canCopy = navigator.clipboard?.write && typeof ClipboardItem === 'function'
    && (ClipboardItem.supports?.('image/png') ?? true);

  useEffect(() => {
    const element = dialog.current;
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    element.showModal();
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  async function share() {
    setFeedback('');
    try {
      await navigator.share({files});
    } catch (error) {
      if (error.name !== 'AbortError') setFeedback('Could not share the photo. Try downloading it.');
    }
  }

  async function copy() {
    setFeedback('');
    try {
      await navigator.clipboard.write([new ClipboardItem({'image/png': file})]);
      setFeedback('Photo copied.');
    } catch {
      setFeedback('Could not copy the photo. Try downloading it.');
    }
  }

  return <dialog className="pixi-polaroid" ref={dialog} aria-label="Your photo"
    onClose={onClose} onKeyDown={event => event.stopPropagation()}
    onClick={event => {
      if (event.target === event.currentTarget) dialog.current.close();
    }}>
    <button type="button" className="pixi-polaroid-close" aria-label="Close photo" title="Close"
      onClick={() => dialog.current.close()}><ActionIcon name="close"/></button>
    <div className="pixi-polaroid-printer">
      <div className="pixi-polaroid-camera" aria-hidden="true">
        <span className="pixi-polaroid-shutter"/>
        <span className="pixi-polaroid-brand">ente world</span>
        <span className="pixi-polaroid-housing">
          <span className="pixi-polaroid-stripe"/>
          <span className="pixi-polaroid-lens"/>
        </span>
        <span className="pixi-polaroid-flash"/>
        <span className="pixi-polaroid-finder"/>
        <span className="pixi-polaroid-slot"/>
      </div>
      <div className="pixi-polaroid-output">
        {url && <img className="pixi-polaroid-photo" data-printed={printed} src={url}
          alt="Photo of your ente world scene" onLoad={() => setPrinted(true)}/>}
      </div>
    </div>
    <div className="pixi-polaroid-actions">
      {url && <a className="pixi-polaroid-primary" href={url} download={file.name} autoFocus>
        <ActionIcon name="download"/><span>Save</span>
      </a>}
      {canShare && <button type="button" onClick={share}>
        <ActionIcon name="share"/><span>Share</span>
      </button>}
      {canCopy && <button type="button" onClick={copy}>
        <ActionIcon name="copy"/><span>Copy</span>
      </button>}
    </div>
    <div className="pixi-polaroid-feedback" role="status">{feedback}</div>
  </dialog>;
}

export default function IslandCamera({island, ready, player, capture}) {
  const button = useRef(null);
  const request = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [file, setFile] = useState(null);

  useEffect(() => () => {request.current = null;}, []);

  async function takePhoto() {
    if (!ready || !island.current || request.current || file) return;
    const parentDialog = button.current.closest('dialog');
    const pending = capture ? capture() : island.current.capturePhoto({player});
    request.current = pending;
    setBusy(true);
    setError('');
    try {
      const blob = await pending;
      if (request.current !== pending || parentDialog?.open === false || document.querySelector('.bog-combat-dock')) return;
      if (Array.from(document.querySelectorAll('dialog:modal')).some(dialog => dialog !== parentDialog)) return;
      island.current?.stopInput();
      setFile(new File([blob], `ente-world-${Date.now()}.png`, {type:'image/png'}));
    } catch {
      if (request.current === pending) setError('Could not take a photo. Try again.');
    } finally {
      if (request.current === pending) {
        request.current = null;
        setBusy(false);
      }
    }
  }

  return <div className="pixi-camera">
    <button type="button" ref={button} aria-label="Camera: take photo" title="Take photo"
      aria-busy={busy} aria-haspopup="dialog" disabled={!ready} onClick={takePhoto}>
      <CameraIcon/>
      <span className="pixi-camera-label">Camera</span>
    </button>
    <div className="pixi-camera-error" role="status">{error}</div>
    {file && <Polaroid file={file} onClose={() => {setFile(null); button.current.focus();}}/>}
  </div>;
}
