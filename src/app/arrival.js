// Set when a player leaves for GitHub sign-in, so the island opens under the cloud cover on the way back.
export const ARRIVE_KEY = 'ew-arrive';
export const arrivalPending = () => {try {return sessionStorage.getItem(ARRIVE_KEY) === '1';} catch {return false;}};
