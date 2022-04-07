import {contract, withHatch} from "framework";

import * as model from './model'
import * as page from './page'

contract({
  model,
  page,
})

export const HomePage = withHatch(model.hatch, page.HomePage);
