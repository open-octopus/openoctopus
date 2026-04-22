interface NavItem {
  path: string;
  icon: string;
  label: string;
  shortLabel: string;
}

export const NAV_ITEMS: NavItem[] = [
  { path: "/", icon: "🏠", label: "家庭总览", shortLabel: "总览" },
  { path: "/route", icon: "🔀", label: "路由视图", shortLabel: "路由" },
  { path: "/members", icon: "👥", label: "家庭成员", shortLabel: "成员" },
  { path: "/entities", icon: "🎯", label: "实体管理", shortLabel: "实体" },
  { path: "/settings", icon: "⚙️", label: "设置", shortLabel: "设置" },
];
