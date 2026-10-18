import { useContext, useEffect, useState, type ReactNode } from "react";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";

import { authKeys } from "@/src/features/auth/queries";
import { billingKeys } from "@/src/features/billing/api";

import { MotionPausedContext } from "./context";
import { balance, demoUser, PACKS, SPEND } from "./fixtures";
import { galleryQueryClient } from "./mockApi";

/** What every tile can assume: a signed-in user with some credits. */
function seedBase(client: QueryClient, reduceMotion: boolean) {
  client.setQueryData(authKeys.me, { user: demoUser(reduceMotion) });
  client.setQueryData(billingKeys.balance, balance(120));
  client.setQueryData(billingKeys.creditPacks, PACKS);
  client.setQueryData(billingKeys.spend, SPEND);
}

/**
 * Its own QueryClient, so a tile shows exactly the data it was seeded with
 * and nothing it fetches can arrive (see mockApi.ts). Leave a key unseeded to
 * show that query's loading state.
 */
export function MockScope({ seed, children }: { seed?: (client: QueryClient) => void; children: ReactNode }) {
  const paused = useContext(MotionPausedContext);
  const [client] = useState(() => {
    const created = galleryQueryClient();
    seedBase(created, paused);
    seed?.(created);
    return created;
  });
  useEffect(() => {
    client.setQueryData(authKeys.me, { user: demoUser(paused) });
  }, [client, paused]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
