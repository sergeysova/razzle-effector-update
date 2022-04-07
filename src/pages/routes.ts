import { RouteConfig } from 'react-router-config'
import {paths} from "~/pages/paths";
import {HomePage} from "~/pages/home";
import {Error404Page} from "~/pages/error404";

export const routes: RouteConfig[] = [
  { exact: true, path: paths.home(), component: HomePage },
  { path: "*", component: Error404Page },
]
