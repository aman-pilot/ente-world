import {httpServerIntegration} from '@sentry/cloudflare';

const errorTypes = new Set([
  'Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'PagesResponseError',
]);
const spanAttributes = ['sentry.op', 'sentry.origin', 'http.request.method', 'http.response.status_code', 'app.route'];

function scrubException({type, mechanism, stacktrace}) {
  return {
    type: errorTypes.has(type) ? type : 'Error',
    value: type === 'PagesResponseError' ? 'Pages returned a server error' : 'Unexpected application error',
    mechanism: mechanism && {type: mechanism.type, handled: mechanism.handled},
    stacktrace: stacktrace && {
      frames: stacktrace.frames?.map(({filename, abs_path, function: name, lineno, colno, in_app}) => ({
        filename: filename?.split(/[?#]/, 1)[0],
        abs_path: abs_path?.split(/[?#]/, 1)[0],
        function: name, lineno, colno, in_app,
      })),
    },
  };
}

export function sentryOptions(env, service, routes) {
  const environment = env.SENTRY_ENVIRONMENT;
  const traceRate = environment === 'local-verification' ? 1 : 0.01;
  const release = env.SENTRY_RELEASE ?? env.CF_VERSION_METADATA?.id;
  const routeFor = url => {
    const pathname = URL.canParse(url) ? new URL(url).pathname : '';
    return routes.has(pathname) ? pathname : undefined;
  };

  return {
    dsn: env.SENTRY_DSN,
    environment,
    release,
    traceLifecycle: 'stream',
    tracesSampler: ({attributes, normalizedRequest}) =>
      attributes?.['sentry.op'] === 'http.server' && routeFor(normalizedRequest?.url) ? traceRate : 0,
    tracePropagationTargets: [],
    strictTraceContinuation: true,
    sendClientReports: false,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      stackFrameVariables: false,
      frameContextLines: 0,
    },
    integrations: defaults => [
      ...defaults.filter(({name}) => !['Console', 'Fetch', 'HttpServer'].includes(name)),
      httpServerIntegration({
        onSpanCreated(span, request) {
          const route = routeFor(request.url);
          if (route) span.setAttribute('app.route', route);
        },
      }),
    ],
    beforeSend(event) {
      const route = event.tags?.route ?? routeFor(event.request?.url);
      return {
        event_id: event.event_id,
        timestamp: event.timestamp,
        platform: event.platform,
        level: event.level,
        environment,
        release,
        tags: {
          service,
          ...(routes.has(route) && {route}),
          ...(Number.isInteger(event.tags?.status) && {status: event.tags.status}),
        },
        exception: event.exception && {values: event.exception.values?.map(scrubException)},
        debug_meta: event.debug_meta,
      };
    },
    beforeSendSpan({links, ...span}) {
      const route = span.attributes['app.route'];
      return {
        ...span,
        name: routes.has(route) ? route : 'Cloudflare operation',
        attributes: {
          ...Object.fromEntries(spanAttributes.filter(key => key in span.attributes).map(key => [key, span.attributes[key]])),
          'sentry.environment': environment,
          ...(release && {'sentry.release': release}),
          service,
        },
      };
    },
    beforeSendLog: () => null,
  };
}
