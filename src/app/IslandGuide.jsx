import {useRef} from 'react';

const desktopControls = [
  ['Walk', 'W A S D or arrow keys'],
  ['Run', 'Shift'],
  ['Jump', 'Space'],
  ['Board or leave a boat', 'Enter'],
  ['Chat', 'C'],
  ['Follow your ducky', 'F'],
  ['Zoom', '+ / −'],
  ['Fit the island in view', '0'],
  ['Fly back to your ducky', 'Home'],
  ['Toggle sound', 'M'],
];

const emotes = [
  ['Quack', 'Q or 1'], ['Dance', 'E'], ['Heart', '2'], ['Laugh', '3'],
  ['Wave', '4'], ['Sleep', '5'], ['Grumpy', '6'], ['Party', '7'],
];

export default function IslandGuide({island}) {
  const trigger = useRef(null);
  const dialog = useRef(null);
  const content = useRef(null);

  function open() {
    island.current?.stopInput();
    dialog.current.showModal();
    content.current.scrollTop = 0;
  }

  return <>
    <button ref={trigger} type="button" className="pixi-guide-button" onClick={open}
      aria-label="Ente World instructions" aria-haspopup="dialog" title="Ente World instructions">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9"/>
        <path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .75-1.5 1-1.5 2.5M12 17h.01"/>
      </svg>
    </button>
    <dialog ref={dialog} className="pixi-guide-dialog" aria-labelledby="pixi-guide-title"
      onClose={() => trigger.current?.focus()} onKeyDown={event => event.stopPropagation()}
      onClick={event => {if (event.target === event.currentTarget) dialog.current.close();}}>
      <header className="pixi-guide-header">
        <h2 id="pixi-guide-title">Ente World instructions</h2>
        <button type="button" className="pixi-guide-close" aria-label="Close instructions" autoFocus
          onClick={() => dialog.current.close()}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>
        </button>
      </header>
      <div ref={content} className="pixi-guide-content" tabIndex={0} role="region" aria-label="Game guide">
        <section>
          <h3>Desktop controls</h3>
          <dl>{desktopControls.map(([action, keys]) => <div key={action}>
            <dt>{action}</dt><dd><kbd>{keys}</kbd></dd>
          </div>)}</dl>
        </section>
        <section>
          <h3>Emotes</h3>
          <dl>{emotes.map(([action, keys]) => <div key={action}>
            <dt>{action}</dt><dd><kbd>{keys}</kbd></dd>
          </div>)}</dl>
        </section>
        <section>
          <h3>Your ducky</h3>
          <p>Explore as a guest, or sign in with GitHub to play and save your ducky’s spot between visits. Dress up with caps, shades, accessories, and shoes.</p>
        </section>
        <section>
          <h3>Islands</h3>
          <p>Visit Home, Sunbob Fields, Pagepond, Rosybutton Bay, Campfire Commons, Iceland, and Booquack Bog. Look for sleeping duckys, birds, butterflies, kites, fountains, and small islets out at sea. Skate on Iceland or step into the museum on Home to see the painting inside.</p>
        </section>
        <section>
          <h3>Sailing</h3>
          <p>Board a boat at a port or along the shore. The sea wraps around the world, and pirate ships sail between the islands. Stranded on an islet? Look for wood, rope, and sail cloth to build a boat on the shore.</p>
        </section>
        <section>
          <h3>Golden feathers and Booquack Bog</h3>
          <p>Walk into glowing golden feathers to pick them up. Collect five in your quiver to unlock Booquack Bog. Choose Karma or Evil and splat the other team. Each reload gives you 12 shots. You start with five lives and lose one after three splats. Use bushes to hide.</p>
        </section>
        <section>
          <h3>Stars and sky</h3>
          <p>Use the telescope to take photos and find the star named after you. Open the globe to see the whole world and look for green shooting stars.</p>
        </section>
        <section>
          <h3>Friends, photos, and music</h3>
          <p>Chat with duckys nearby and make friends. See who’s online and choose whether friends appear on your mini-map and globe. Use the Polaroid camera to take a photo you can save or share.</p>
          <p>Use the Ente Music player to change tracks or adjust the music volume.</p>
        </section>
      </div>
    </dialog>
  </>;
}
