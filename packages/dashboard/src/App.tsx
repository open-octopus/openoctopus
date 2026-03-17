import { BrowserRouter, Routes, Route } from "react-router";
import { Shell } from "./components/layout/Shell";
import { Home } from "./pages/Home";

function Placeholder({ name }: { name: string }) {
  return <div className="p-6 text-lg text-ocean">{name} - Coming Soon</div>;
}

export function App() {
  return (
    <BrowserRouter basename="/dashboard">
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Home />} />
          <Route path="route" element={<Placeholder name="🔀 路由视图" />} />
          <Route path="members" element={<Placeholder name="👥 家庭成员" />} />
          <Route path="entities" element={<Placeholder name="🎯 实体管理" />} />
          <Route path="settings" element={<Placeholder name="⚙️ 设置" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
