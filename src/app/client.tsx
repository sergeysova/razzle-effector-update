import React from 'react'
import ReactDOM from 'react-dom'
import {allSettled, createEvent, createStore, fork, sample} from "effector";
import {Router} from 'react-router'

import {history, historyUpdated, initializeClientHistory} from "~/entities/navigation";
import {HelmetProvider} from "react-helmet-async";
import {Provider} from "effector-react/scope";
import {Application} from "~/app/application";
import {splitMap} from "patronum/split-map";
import {matchRoutes} from "react-router-config";
import {routes} from "~/pages/routes";
import {getHatch, HatchParams} from "framework";

const ready = createEvent()

const {routeResolved, __: routeNotResolved} = splitMap({
  source: historyUpdated,
  cases: {
    routeResolved(update) {
      const matchedRoutes = matchRoutes(routes, update.pathname);
      if (matchedRoutes.length > 0) {
        return {
          route: matchedRoutes[0].route,
          match: matchedRoutes[0].match,
          update,
        }
      }

      return undefined; // explicitly skip to `routeNotResolved` case
    }
  },
})

function extractCurrentRoutePath() {
  const matchedRoutes = matchRoutes(routes, history?.location.pathname ?? '/');

  if (matchedRoutes.length > 0) {
    return matchedRoutes[0].route.path;
  }
  return '/';
}

const $currentRoute = createStore(extractCurrentRoutePath())

for (const { component, path } of routes) {
  if (!component) continue;
  const hatch = getHatch(component);
  if (!hatch) continue;

  const { routeMatched, __: routeNotMatched } = splitMap({
    source: routeResolved,
    cases: {
      routeMatched({ route, match, update }) {
        if (route.path === path) {
          return {
            params: match.params,
            query: Object.fromEntries(new URLSearchParams(update.search)),
          } as HatchParams;
        }

        return undefined; // explicitly skip to `routeNotMatched` case
      }
    },
  });

  // You can add chunk loading logic here

  const hatchEnter = createEvent<HatchParams>();
  const hatchUpdate = createEvent<HatchParams>();
  const hatchExit = createEvent<void>();

  if (hatch) {
    // If you add chunk loading, hatch will appear only after required chunk finished loading
    sample({ clock: hatchEnter, to: hatch.enter })
    sample({ clock: hatchUpdate, to: hatch.update })
    sample({ clock: hatchExit, to: hatch.exit })
  }

  const $onCurrentPage = $currentRoute.map((route) => route === path);

  sample({
    clock: routeNotMatched,
    source: $currentRoute,
    filter: (currentRoute, { route: { path: newRoute } }) => {
      const pageRoute = path;

      const isANewRouteDifferent = currentRoute !== newRoute;
      const isCurrentRouteOfCurrentPage = currentRoute === pageRoute;

      return isCurrentRouteOfCurrentPage && isANewRouteDifferent;
    },
    target: hatchExit,
  })

  sample({
    clock: routeMatched,
    filter: $onCurrentPage,
    target: hatchUpdate,
  })

  const shouldEnter = sample({
    clock: routeMatched,
    filter: $onCurrentPage.map(on => !on),
  })

  sample({ clock: shouldEnter, target: hatchEnter })

  sample({
    clock: shouldEnter,
    fn: () => path,
    target: $currentRoute
  })
}

const scope = fork({values: window['INITIAL_STATE']})
delete window['INITIAL_STATE'];

initializeClientHistory(scope);

allSettled(ready, {scope}).then(() => {
  ReactDOM.hydrate(
    <HelmetProvider>
      <Router history={history!}>
        <Provider value={scope}>
          <Application/>
        </Provider>
      </Router>
    </HelmetProvider>,
    document.querySelector('#root'),
  )
})

if (module.hot) {
  module.hot.accept()
}
