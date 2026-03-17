import { RealmGrid } from "../components/realm/RealmGrid";
import { Timeline } from "../components/realm/Timeline";

export function Home() {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-ocean">🐙 王家 · 家庭管家</h1>
      </div>
      <RealmGrid />
      <Timeline />
    </div>
  );
}
