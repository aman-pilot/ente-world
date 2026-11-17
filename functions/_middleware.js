import {captureException, sentryPagesPlugin} from '@sentry/cloudflare';
import {sentryOptions} from '../server/sentry.js';

const routes = new Set([
  '/api/friends', '/api/outfit', '/api/play-access', '/api/room', '/api/session', '/api/stars',
  '/arena-room', '/auth/github/callback', '/auth/github/start', '/auth/logout',
]);

const monitorRequest = sentryPagesPlugin(({env}) => sentryOptions(env, 'pages', routes));

export const onRequest = [
  context => context.env.SENTRY_DSN ? monitorRequest(context) : context.next(),
  async context => {
    const response = await context.next();
    const route = new URL(context.request.url).pathname;
    if (context.env.SENTRY_DSN && response.status >= 500 && routes.has(route)) {
      const error = new Error('Pages returned a server error');
      error.name = 'PagesResponseError';
      captureException(error, {tags: {route, status: response.status}});
    }
    return response;
  },
];
