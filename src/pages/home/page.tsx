import React from "react";
import {createStore} from "effector";
import {useStore} from "effector-react/scope";

export const $value = createStore(0)

export const HomePage = () => {
  const value = useStore($value)

  return (
    <div>
      <h1>Home page</h1>
      <p>Value: {value}</p>
    </div>
  )
}
