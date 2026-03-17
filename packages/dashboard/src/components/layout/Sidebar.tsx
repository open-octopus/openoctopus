import { NavLink } from "react-router";

const NAV_ITEMS = [
  { path: "/", icon: "🏠", label: "家庭总览" },
  { path: "/route", icon: "🔀", label: "路由视图" },
  { path: "/members", icon: "👥", label: "家庭成员" },
  { path: "/entities", icon: "🎯", label: "实体管理" },
  { path: "/settings", icon: "⚙️", label: "设置" },
];

export function Sidebar() {
  return (
    <nav className="hidden md:flex flex-col w-56 bg-white border-r border-gray-200 p-4 gap-1">
      <div className="flex items-center gap-2 px-3 py-4 mb-4">
        <span className="text-2xl">🐙</span>
        <span className="font-bold text-ocean text-lg">家庭管家</span>
      </div>
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === "/"}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
              isActive
                ? "bg-cyan/10 text-ocean font-medium"
                : "text-gray-600 hover:bg-gray-100"
            }`
          }
        >
          <span className="text-lg">{item.icon}</span>
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
