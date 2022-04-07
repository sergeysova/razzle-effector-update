import {createBrowserHistory} from 'history'
import {createEvent, createStore, merge, Scope, scopeBind} from "effector";

/**
 * When history is already updated for some reason
 */
export interface HistoryUpdate {
  pathname: string;
  hash: string;
  search: string;
  state: unknown;
  action: 'PUSH' | 'POP' | 'REPLACE';
}

/**
 * When you need to update history from effector model
 */
export interface HistoryChange {
  pathname?: string | undefined;
  search?: string | undefined;
  state?: unknown | undefined;
  hash?: string | undefined;
  key?: string | undefined;
}

export const history = process.env.BUILD_TARGET === 'client' ? createBrowserHistory() : null;

export const $redirectTo = createStore('', { serialize: 'ignore' })

export const historyPush = createEvent<string | HistoryChange>()
export const historyReplace = createEvent<string | HistoryChange>()

export const historyUpdated = createEvent<HistoryUpdate>()

export function initializeClientHistory(scope: Scope) {
  historyPush.watch((update) => history?.push(update))
  historyReplace.watch((update) => history?.replace(update))

  const boundHistoryUpdated = scopeBind(historyUpdated, {scope});
  history!.listen(({pathname, search, hash, state}, action) => {
    boundHistoryUpdated({
      pathname,
      search,
      state,
      hash,
      action,
    })
  })
}

// TODO: required to set $redirectTo on server side to the url that was requested
// If $redirectTo is different from url requested, then redirect to $redirectTo
export function initializeServerHistory() {
  const historyChange = merge([historyPush, historyReplace]);
  $redirectTo.on(historyChange, (prevPath, pathOrChange) => {
    if (typeof pathOrChange === 'string') {
      return pathOrChange
    }
    const url = new URL(pathOrChange.pathname || prevPath);
    url.search = pathOrChange.search || url.search;
    url.hash = pathOrChange.hash || url.hash;
    return url.toString()
  })
}
