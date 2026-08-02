import { NavLink, useLocation } from "react-router-dom";
import { Home, ClipboardList, BarChart3, Sparkles, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { path: "/", label: "首页", icon: Home },
  { path: "/records", label: "记录", icon: ClipboardList },
  { path: "/income", label: "收入", icon: BarChart3 },
  { path: "/predict", label: "预测", icon: Sparkles },
  { path: "/goals", label: "目标", icon: Trophy },
];

export default function BottomNav() {
  const location = useLocation();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-cream-50/90 backdrop-blur-xl border-t border-mocha-100">
      <div className="max-w-md mx-auto flex items-center justify-around h-16 pb-safe">
        {items.map((item) => {
          const active = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center w-16 h-14 rounded-2xl transition-all duration-300",
                active ? "text-mocha-700 -translate-y-1" : "text-mocha-300 hover:text-mocha-400"
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full mb-0.5 transition-all",
                  active ? "bg-blush-100 shadow-soft" : "bg-transparent"
                )}
              >
                <item.icon size={20} strokeWidth={active ? 2.5 : 2} />
              </div>
              <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
