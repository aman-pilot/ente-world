import {env} from 'cloudflare:workers';
import {instrumentDurableObjectWithSentry} from '@sentry/cloudflare';
import {sentryOptions} from '../server/sentry.js';
import {IslandRoom as Room} from './index.js';

const routes = new Set([
  '/room', '/bog-room', '/friends', '/outfit', '/stars', '/stars/count', '/flow', '/consume',
  '/session/new', '/session/access', '/session/get', '/session/revoke',
]);

export const IslandRoom = env.SENTRY_DSN
  ? instrumentDurableObjectWithSentry(bindings => sentryOptions(bindings, 'room', routes), Room)
  : Room;

export {default} from './index.js';
