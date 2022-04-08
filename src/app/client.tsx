import React from 'react'
import ReactDOM from 'react-dom'
import {allSettled, createEvent, fork} from "effector";
import {Router} from 'react-router'

import {history, initializeClientHistory} from "~/entities/navigation";
import {HelmetProvider} from "react-helmet-async";
import {Provider} from "effector-react/scope";
import {Application} from "~/app/application";

const ready = createEvent()

const scope = fork({values: window['INITIAL_STATE']})
delete window['INITIAL_STATE'];

initializeClientHistory(scope);

allSettled(ready, {scope}).then(() => {
  ReactDOM.hydrate(
    <HelmetProvider>
      <Router history={history!}>
        <Provider value={scope}>
          <Application />
        </Provider>
      </Router>
    </HelmetProvider>,
    document.querySelector('#root'),
  )
})

if (module.hot) {
  module.hot.accept()
}
