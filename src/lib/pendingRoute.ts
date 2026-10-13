import type { Href } from "expo-router";

// Remembers where a guest wanted to go, so we can send them there after login.
let pending: Href | null = null;

export function setPendingRoute(route: Href) {
  pending = route;
}

export function clearPendingRoute() {
  pending = null;
}

export function takePendingRoute(): Href | null {
  const route = pending;
  pending = null;
  return route;
}
