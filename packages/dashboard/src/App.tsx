import { BrowserRouter, Routes, Route } from "react-router";
import { Shell } from "./components/layout/Shell";
import { Entities } from "./pages/Entities";
import { Home } from "./pages/Home";
import { Members } from "./pages/Members";
import { RouteView } from "./pages/RouteView";
import { Settings } from "./pages/Settings";

export function App() {
  return (
    <BrowserRouter basename="/dashboard">
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Home />} />
          <Route path="route" element={<RouteView />} />
          <Route path="members" element={<Members />} />
          <Route path="entities" element={<Entities />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
