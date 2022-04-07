import {createDomain, createEffect, createStore, sample} from "effector";
import {createHatch} from "framework";

const randomValueFx = createEffect(() => {
  return Math.floor(Math.random() * 1000);
});

export const hatch = createHatch(createDomain('HomePage'))
export const $value = createStore(0)

sample({
  clock: hatch.enter,
  target: randomValueFx,
})

$value.on(randomValueFx.doneData, (_, value) => value)

