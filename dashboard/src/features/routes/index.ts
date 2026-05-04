export { default as RoutesPage } from './RoutesPage'
export { default as RouteDetailPage } from './RouteDetailPage'
export {
  useRoutes,
  useRouteDetail,
  useCreateRoute,
  useAssignClientToRoute,
  useAssignDriverToRoute,
  useRemoveClientFromRoute,
} from './useRoutes'
export type {
  Route,
  RouteDetail,
  RouteClient,
  RouteDriver,
  CreateRouteInput,
  AssignClientInput,
  AssignDriverInput,
  RemoveClientInput,
} from './useRoutes'
