// Set when a player leaves for GitHub sign-in, so the island opens under the cloud cover on the way back.
export const ARRIVE_KEY = 'ew-arrive';
export const arrivalPending = () => {try {return sessionStorage.getItem(ARRIVE_KEY) === '1';} catch {return false;}};

// The next page can paint the connection screen while it checks the actual session.
export function rememberSignedIn(signedIn) {
  try {
    if (signedIn) sessionStorage.setItem('ew-signed-in', '1');
    else sessionStorage.removeItem('ew-signed-in');
  } catch {/* Storage may be unavailable. */}
}
