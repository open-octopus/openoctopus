import { BrowserRouter, Routes, Route } from "react-router";
import { Shell } from "./components/layout/Shell";
import { Home } from "./pages/Home";
import { Members } from "./pages/Members";
import { RouteView } from "./pages/RouteView";

function Placeholder({ name }: { name: string }) {
  return <div className="p-6 text-lg text-ocean">{name} - Coming Soon</div>;
}

export function App() {
  return (
    <BrowserRouter basename="/dashboard">
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Home />} />
          <Route path="route" element={<RouteView />} />
          <Route path="members" element={<Members />} />
          <Route path="entities" element={<Placeholder name="🎯 实体管理" />} />
          <Route path="settings" element={<Placeholder name="⚙️ 设置" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
