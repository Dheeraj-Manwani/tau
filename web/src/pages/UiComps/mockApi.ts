/**
 * Keeps /ui-comps off the network. While the browser is on the gallery, every
 * request through the shared axios instance is answered here: reads never
 * resolve (an unseeded query stays in its loading state, which is a state worth
 * seeing) and writes fail with a 503 that says nothing was sent. Data comes
 * from each tile's own QueryClient, seeded with fixtures.
 *
 * Gated on the path rather than on mount, so a query that fires before the
 * gallery's own effects run can never reach the real API.
 */
import { AxiosError, type AxiosAdapter } from "axios";
import { QueryClient, type QueryKey } from "@tanstack/react-query";

import { api } from "@/src/lib/api-client";

export const GALLERY_PATH = "/ui-comps";

const offline: AxiosAdapter = (config) => {
  if ((config.method ?? "get").toLowerCase() === "get") return new Promise(() => {});
  return Promise.reject(
    new AxiosError("Offline", AxiosError.ERR_BAD_RESPONSE, config, null, {
      status: 503,
      statusText: "Offline",
      data: { error: "Not sent: /ui-comps never talks to the API." },
      headers: {},
      config,
    }),
  );
};

let installed = false;

export function installOfflineApi(): void {
  if (installed) return;
  installed = true;
  // Request interceptors run newest first, so this sees every request.
  api.interceptors.request.use((config) => {
    if (window.location.pathname.startsWith(GALLERY_PATH)) config.adapter = offline;
    return config;
  });
}

/** A client that only ever shows what it was seeded with. */
export function galleryQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        retryOnMount: false,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
      mutations: { retry: false },
    },
  });
}

/** Put a query into its error state, as if its last fetch had failed. */
export function seedError(client: QueryClient, queryKey: QueryKey, error: Error): void {
  const query = client.getQueryCache().build(client, { queryKey });
  query.setState({
    ...query.state,
    status: "error",
    error,
    errorUpdatedAt: Date.now(),
    fetchFailureCount: 1,
    fetchFailureReason: error,
    fetchStatus: "idle",
  });
}
