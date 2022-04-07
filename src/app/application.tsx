import React from 'react'
import {Helmet} from 'react-helmet-async'
import {Pages} from "~/pages/pages";

export const Application = () => (
  <main>
    <Helmet
      titleTemplate="%s - Effector Application"
      htmlAttributes={{lang: 'en'}}
      defaultTitle="Welcome"
    >
      <meta httpEquiv="X-UA-Compatible" content="IE=edge"/>
      <meta charSet="utf-8"/>
      <meta name="viewport" content="width=device-width, initial-scale=1"/>
    </Helmet>
    <Pages />
  </main>
)
