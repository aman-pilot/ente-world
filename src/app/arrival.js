// Set when a player leaves for GitHub sign-in, so the island opens under the cloud cover on the way back.
export const ARRIVE_KEY = 'ew-arrive';
export const arrivalPending = () => {try {return sessionStorage.getItem(ARRIVE_KEY) === '1';} catch {return false;}};

// The next page can paint the cloud cover while it checks the actual session. Kept in localStorage so a new tab or
// a fresh visit knows too (sessionStorage is per tab, so only a reload in the same tab got the cover).
export function rememberSignedIn(signedIn) {
  try {
    if (signedIn) localStorage.setItem('ew-signed-in', '1');
    else localStorage.removeItem('ew-signed-in');
  } catch {/* Storage may be unavailable. */}
}
