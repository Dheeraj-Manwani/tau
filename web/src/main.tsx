import { StrictMode, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Navigate, Outlet, RouterProvider } from "react-router-dom";

import "./index.css";
import { SplashScreen } from "./components/SplashScreen";
import { Providers } from "./components/providers";
import {
  AuthBootstrap,
  RequireAuth,
  RequireGuest,
  RequireUnverified,
} from "./features/auth/guards";
import { capturePendingPromptFromUrl } from "./lib/promptHandoff";

capturePendingPromptFromUrl();

const lazyComponent =
  (load: () => Promise<{ default: ComponentType }>) => async () => ({
    Component: (await load()).default,
  });

const router = createBrowserRouter([
  {
    element: <Outlet />,
    hydrateFallbackElement: <SplashScreen />,
    children: [
      {
        element: <RequireAuth />,
        children: [
          {
            path: "/",
            lazy: lazyComponent(() => import("./components/AppShell")),
            children: [
              {
                index: true,
                lazy: lazyComponent(() => import("./pages/Home")),
              },
              {
                path: "project/:id",
                lazy: lazyComponent(
                  () => import("./features/project/ProjectPage"),
                ),
              },
              {
                path: "billing",
                lazy: lazyComponent(() => import("./pages/Billing")),
              },
              {
                path: "account",
                lazy: lazyComponent(() => import("./pages/Account")),
              },
            ],
          },
        ],
      },
      {
        element: <RequireGuest />,
        children: [
          {
            path: "/login",
            lazy: lazyComponent(() => import("./pages/Login")),
          },
          {
            path: "/signup",
            lazy: lazyComponent(() => import("./pages/SignUp")),
          },
          {
            path: "/auth/callback",
            lazy: lazyComponent(() => import("./pages/OAuthCallback")),
          },
        ],
      },
      {
        element: <RequireUnverified />,
        children: [
          {
            path: "/verify-pending",
            lazy: lazyComponent(() => import("./pages/VerifyPending")),
          },
        ],
      },
      {
        path: "/verify-email",
        lazy: lazyComponent(() => import("./pages/VerifyEmail")),
      },
      {
        path: "/checkout",
        lazy: lazyComponent(() => import("./pages/Checkout")),
      },
      // Every screen's states and every primitive (pages/UiComps); dev builds only.
      ...(import.meta.env.DEV
        ? [
            {
              path: "/ui-comps/*",
              lazy: lazyComponent(() => import("./pages/UiComps")),
            },
            {
              path: "/_kit",
              element: <Navigate to="/ui-comps#primitives-buttons" replace />,
            },
          ]
        : []),
      {
        path: "*",
        lazy: lazyComponent(() => import("./pages/NotFound")),
      },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Providers>
      <AuthBootstrap>
        <RouterProvider router={router} />
      </AuthBootstrap>
    </Providers>
  </StrictMode>,
);
