export default function IslandConnecting() {
  const loader = window.EWArrival?.loader('Connecting to your island');
  return <div className="island-connecting" role="status" aria-label="Connecting to your island">
    {loader
      ? <div className="arrival-loader" aria-hidden="true" dangerouslySetInnerHTML={{__html:loader}}/>
      : 'Connecting to your island…'}
  </div>;
}
