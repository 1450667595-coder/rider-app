import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import BottomNav from "./BottomNav";
import useStore from "@/store/useStore";

export default function Layout() {
  const init = useStore((s) => s.init);

  useEffect(() => {
    init();
  }, []);

  return (
    <div className="min-h-dvh bg-cream-50 text-mocha-800 font-sans">
      <main className="max-w-md mx-auto pb-24 px-5 pt-6">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
