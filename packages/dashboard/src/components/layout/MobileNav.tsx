import { NavLink } from "react-router";

const NAV_ITEMS = [
  { path: "/", icon: "🏠", label: "总览" },
  { path: "/route", icon: "🔀", label: "路由" },
  { path: "/members", icon: "👥", label: "成员" },
  { path: "/entities", icon: "🎯", label: "实体" },
  { path: "/settings", icon: "⚙️", label: "设置" },
];

export function MobileNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around py-2 z-50">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === "/"}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 px-2 py-1 text-xs ${
              isActive ? "text-ocean font-medium" : "text-gray-500"
            }`
          }
        >
          <span className="text-xl">{item.icon}</span>
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
