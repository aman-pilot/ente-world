import {useEffect, useRef, useState} from 'react';

// Signed in but no star on ente/ente yet: Ducky holds the top of the box, one plain title, three actions.
export default function StarDialog({onClose, onConfirm}) {
  const dialog = useRef(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [signInRequired, setSignInRequired] = useState(false);

  async function retry() {
    setChecking(true);
    setError('');
    try {
      const response = await fetch('/api/play-access',{method:'POST'});
      const result = await response.json();
      if (!response.ok) {
        setSignInRequired(response.status === 401);
        throw new Error(result.error || 'Could not check your star. Please try again.');
      }
      if (result.canPlay) onConfirm();
      else setError('No star found yet. Star ente/ente with the account you signed in with.');
    } catch (error) {
      setError(error.message || 'Could not check your star. Please try again.');
    } finally {
      setChecking(false);
    }
  }
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);

  return <dialog ref={dialog} className="star-box" aria-labelledby="star-title"
    onClose={event => {if (!event.currentTarget.open) onClose();}} onKeyDown={event => event.stopPropagation()}>
    <div className="star-box-wrap">
      <div className="star-box-duck" aria-hidden="true">
        <img src="/guest/ducky-peek-body.webp" width="1024" height="640" alt=""/>
        <img className="star-box-beak" src="/guest/ducky-peek-beak.webp" width="176" height="89" alt=""/>
        <span className="star-box-eye star-box-eye-l"/><span className="star-box-eye star-box-eye-r"/>
      </div>
      <div className="star-box-card" tabIndex={-1} autoFocus>
        <h2 id="star-title">Star Ente to join the island</h2>
        {error && <p className="star-box-error" role="alert">{error}</p>}
        <a className="star-box-btn star-box-go" href="https://github.com/ente/ente" target="_blank" rel="noopener noreferrer">Star ente/ente</a>
        <button className="star-box-btn star-box-check" type="button" onClick={retry} disabled={checking}>{checking ? 'Checking…' : 'I’ve starred it, let me in'}</button>
        {signInRequired && <a className="star-box-btn star-box-check" href="/auth/github/start">Sign in again</a>}
        <button className="star-box-watch" type="button" onClick={onClose}>Keep watching</button>
      </div>
      <div className="star-box-duck star-box-wings" aria-hidden="true"><img src="/guest/ducky-peek-wings.webp" width="1024" height="640" alt=""/></div>
    </div>
  </dialog>;
}
