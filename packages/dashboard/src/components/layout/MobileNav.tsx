import { NavLink } from "react-router";
import { NAV_ITEMS } from "./nav-items";

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
          {item.shortLabel}
        </NavLink>
      ))}
    </nav>
  );
}
