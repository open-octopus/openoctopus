import { TopologyGraph } from "../components/family/TopologyGraph";

const PLACEHOLDER_MEMBERS = [
  { id: "grandpa", name: "\u7237\u7237", icon: "\u{1F474}" },
  { id: "dad", name: "\u7238\u7238", icon: "\u{1F468}" },
  { id: "mom", name: "\u5988\u5988", icon: "\u{1F469}" },
  { id: "daughter", name: "\u5973\u513F", icon: "\u{1F467}" },
];

const PLACEHOLDER_ROUTES = [
  { from: "grandpa", to: "dad", relevance: "high" as const, pushed: true },
  { from: "grandpa", to: "mom", relevance: "medium" as const, pushed: true },
  { from: "grandpa", to: "daughter", relevance: "low" as const, pushed: false },
];

export function RouteView() {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl">
      <h1 className="text-xl font-bold text-ocean">{"\u{1F500}"} \u6D88\u606F\u8DEF\u7531</h1>
      <TopologyGraph members={PLACEHOLDER_MEMBERS} routes={PLACEHOLDER_ROUTES} />

      <div className="bg-white rounded-card border border-gray-200 p-4">
        <h3 className="text-sm font-medium text-ocean mb-3">\u6700\u8FD1\u8DEF\u7531</h3>
        <div className="space-y-3">
          <div className="text-xs space-y-1">
            <p className="font-medium text-gray-800">[\u7237\u7237\u819D\u76D6\u75BC] Health {"\u2192"} Finance, Calendar</p>
            <p className="text-gray-600 pl-3">{"\u2192"} {"\u{1F468}"} \u7238\u7238\uFF1A\u5C31\u533B\u5EFA\u8BAE\uFF08\u9AD8\u76F8\u5173\uFF09</p>
            <p className="text-gray-600 pl-3">{"\u2192"} {"\u{1F469}"} \u5988\u5988\uFF1A\u91C7\u8D2D\u6B62\u75DB\u8D34\uFF08\u4E2D\u76F8\u5173\uFF09</p>
            <p className="text-gray-400 pl-3">{"\u2192"} {"\u{1F467}"} \u5973\u513F\uFF1A\u672A\u63A8\u9001\uFF08\u4F4E\u76F8\u5173\uFF09</p>
          </div>
        </div>
      </div>
    </div>
  );
}
