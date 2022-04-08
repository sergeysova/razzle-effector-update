import type {Server} from 'http';
import * as path from 'path';

import through from 'through'
import fastify, {FastifyReply, FastifyRequest} from 'fastify';
import fastifyCookie from 'fastify-cookie';
import fastifyStatic from 'fastify-static';
import {RouteGenericInterface} from 'fastify/types/route';
import {getHatch, HatchParams} from 'framework';

import {splitMap} from 'patronum/split-map';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import {FilledContext, HelmetProvider} from 'react-helmet-async';
import {matchRoutes} from 'react-router-config';
import {StaticRouter} from 'react-router-dom';

import {$redirectTo, initializeServerHistory} from '~/entities/navigation'
import {allSettled, createEvent, fork, sample, serialize} from "effector";
import {routes} from "~/pages/routes";
import {Provider} from "effector-react/scope";
import {Application} from "~/app/application";

initializeServerHistory()

const serverStarted = createEvent<{
  req: FastifyRequest<RouteGenericInterface, Server>;
  res: FastifyReply<Server>;
}>()
const requestHandled = serverStarted.map(({req}) => req)

const {routeResolved, __: routeNotResolved} = splitMap({
  source: requestHandled,
  cases: {
    routeResolved({url, query}) {
      const matchedRoutes = matchRoutes(routes, url.split('?')[0]);
      if (matchedRoutes.length > 0) {
        return {
          route: matchedRoutes[0].route,
          match: matchedRoutes[0].match,
          url,
          query,
        }
      }
      return undefined; // explicitly skip to the `routeNotResolved` case
    }
  }
})

routeNotResolved.watch(({url}) => {
  console.error(`FATAL: Route not found for url "${url}"`)
  process.exit(-1)
})

// TODO: here you need to load session from cookies
// Just create an event readyToLoadSession and sessionLoaded
// And replace `requestHandled` with `sessionLoaded`
const readyToMatchRoute = sample({source: routeResolved})

for (const {component, path} of routes) {
  if (!component) {
    console.warn(`No component found for path ${path}`)
    continue;
  }

  const hatch = getHatch(component)
  if (!hatch) {
    continue;
  }

  const {routeMatched, __: routeNotMatched} = splitMap({
    source: readyToMatchRoute,
    cases: {
      routeMatched({route, match, query}) {
        if (route.path === path) {
          return {
            // route.path is a string with path params, like "/user/:userId"
            // :userId is a path param
            // match.params is an object contains parsed params values
            // "/user/123" will be transformed to { userId: 123 } in match.params
            params: match.params,
            query
          } as HatchParams;
        }

        return undefined; // explicitly skip to `routeNotMatched` case
      },
    },
  })

  sample({clock: routeMatched, target: hatch.enter})
  sample({source: serverStarted, clock: routeNotMatched}).watch(({ res }) => res.status(404))
}

// TODO: uncomment next lines and modify to set cookies
// Don't forget to mark $cookiesFromBackendResponse and $cookiesForEachRequest stores with { serialize: 'ignore' }
/*
sample({
  source: serverStarted,
  clock: $cookiesFromBackendResponse,
  fn: ({ res }, cookies) => ({ res, cookies })
}).watch(({ res, cookies }) => res.header('Set-Cookie', cookies))
*/

// We save current url, to be able to compare if it is changed during allSettled run
$redirectTo.on(serverStarted, (_, {req}) => req.url)

sample({
  source: serverStarted,
  clock: $redirectTo,
  filter: ({req}, redirectTo) => req.url !== redirectTo,
  fn: ({res}, redirectTo) => ({res, redirectTo})
}).watch(({res, redirectTo}) => res.redirect(redirectTo))

let assets: any; // eslint-disable-line @typescript-eslint/no-explicit-any

function syncLoadAssets() {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  assets = require(process.env.RAZZLE_ASSETS_MANIFEST!);
}

const PUBLIC_URL = process.env.PUBLIC_URL || '/'

syncLoadAssets()

function createFastify() {
  // Add there options for HTTPS and logger
  return fastify()
}

export const fastifyInstance = createFastify()

// Here you can add proxy to your backend via `fastify-http-proxy`

fastifyInstance.register(fastifyStatic, {
  root: path.resolve(process.env.RAZZLE_PUBLIC_DIR!),
  wildcard: false,
})

fastifyInstance.register(fastifyCookie)

fastifyInstance.get('/*', async function handleRequest(req, res) {
  const scope = fork();
  try {
    await allSettled(serverStarted, {
      scope,
      params: {req, res},
    })
  } catch (error) {
    console.error("AllSettled failure on handling request", error)
  }

  if (isRedirected(res)) {
    res.send();
    return;
  }

  const storesValues = serialize(scope);
  const routerContext = {}
  const helmetContext = {} as FilledContext;

  res.header('Content-Type', 'text/html');
  const appContent = ReactDOMServer.renderToNodeStream(
    <HelmetProvider context={helmetContext}>
      <StaticRouter location={req.url} context={routerContext}>
        <Provider value={scope}>
          <Application/>
        </Provider>
      </StaticRouter>
    </HelmetProvider>
  )

  let headerSent = false;

  res.send(appContent.pipe(
    through(
      function write(data) {
        if (!headerSent) {
          this.queue(
            htmlStart({helmet: helmetContext.helmet, assetsCss: assets.client.css, assetsJs: assets.client.js})
          )
          headerSent = true;
        }
        this.queue(data);
      },
      function end() {
        this.queue(
          htmlEnd({storesValues, helmet: helmetContext.helmet})
        )
        this.queue(null)
      }
    )
  ))
})


interface StartProps {
  assetsCss?: string;
  assetsJs: string;
  helmet: FilledContext['helmet'];
}

interface EndProps {
  storesValues: Record<string, unknown>;
  helmet: FilledContext['helmet'];
}

function htmlStart(props: StartProps) {
  return `<!doctype html>
  <html ${props.helmet.htmlAttributes.toString()} lang='en'>
    <head>
      ${props.helmet.base.toString()}
      ${props.helmet.meta.toString()}
      ${props.helmet.title.toString()}
      ${props.helmet.link.toString()}
      ${props.helmet.style.toString()}
      ${props.assetsCss ? `<link rel='stylesheet' href='${props.assetsCss}'>` : ''}
      ${
    process.env.NODE_ENV === 'production'
      ? `<script src='${props.assetsJs}' defer></script>`
      : `<script src='${props.assetsJs}' defer crossorigin></script>`
  }
    </head>
    <body ${props.helmet.bodyAttributes.toString()}>
      <div id='root'>`;
}

function htmlEnd(props: EndProps) {
  return `</div>
    <script>
      window['INITIAL_STATE'] = ${JSON.stringify(props.storesValues)}
    </script>
    ${props.helmet.script.toString()}
    ${props.helmet.noscript.toString()}
    ${
    process.env.STATUSPAGE_ID
      ? `<script src='https://${process.env.STATUSPAGE_ID}.statuspage.io/embed/script.js'></script>`
      : ''
  }
  </body>
</html>
  `;
}


function isRedirected(response: FastifyReply<Server>): boolean {
  return response.statusCode >= 300 && response.statusCode < 400
}
