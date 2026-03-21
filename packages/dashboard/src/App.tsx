import { createBrowserRouter, RouterProvider } from "react-router";
import { ErrorBoundary } from "./components/layout/ErrorBoundary";
import { Shell } from "./components/layout/Shell";
import { Entities } from "./pages/Entities";
import { Home } from "./pages/Home";
import { Members } from "./pages/Members";
import { RouteView } from "./pages/RouteView";
import { Settings } from "./pages/Settings";

const router = createBrowserRouter(
  [
    {
      element: <Shell />,
      children: [
        { index: true, element: <Home /> },
        { path: "route", element: <RouteView /> },
        { path: "members", element: <Members /> },
        { path: "entities", element: <Entities /> },
        { path: "settings", element: <Settings /> },
      ],
    },
  ],
  { basename: "/dashboard" },
);

export function App() {
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
}
