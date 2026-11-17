import {env} from 'cloudflare:workers';
import {instrumentDurableObjectWithSentry, logger} from '@sentry/cloudflare';
import {sentryOptions} from '../server/sentry.js';
import {IslandRoom as Room} from './index.js';

const routes = new Set([
  '/room', '/bog-room', '/friends', '/outfit', '/stars', '/stars/count', '/flow', '/consume',
  '/session/new', '/session/access', '/session/get', '/session/revoke',
]);

class MonitoredRoom extends Room {
  logCounts() {
    let players = 0;
    for (const info of this.connections.values()) if (info.actor) players++;
    return {connections: this.connections.size, players, watchers: this.connections.size - players};
  }

  async fetch(request) {
    const route = new URL(request.url).pathname;
    const started = Date.now();
    try {
      const response = await super.fetch(request);
      logger[response.status >= 500 ? 'error' : 'info']('Room request completed', {
        route, status: response.status, duration_ms: Date.now() - started, ...this.logCounts(),
      });
      return response;
    } catch (error) {
      logger.error('Room request failed', {route, duration_ms: Date.now() - started, ...this.logCounts()});
      throw error;
    }
  }

  webSocketClose(socket, code, reason, wasClean) {
    logger[code === 1000 || code === 1001 ? 'info' : 'warn']('Room socket closed', {
      close_code: code, ...this.logCounts(),
    });
    return super.webSocketClose(socket, code, reason, wasClean);
  }

  webSocketError(socket, error) {
    logger.error('Room socket error', this.logCounts());
    return super.webSocketError(socket, error);
  }
}

export const IslandRoom = env.SENTRY_DSN
  ? instrumentDurableObjectWithSentry(bindings => sentryOptions(bindings, 'room', routes), MonitoredRoom)
  : Room;

export {default} from './index.js';
