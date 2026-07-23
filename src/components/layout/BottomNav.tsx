import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  CalendarDays,
  TrendingUp,
  LineChart,
  Target,
  BarChart3,
  Award,
  FileText,
} from "lucide-react";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "仪表盘" },
  { to: "/records", icon: CalendarDays, label: "记录" },
  { to: "/income", icon: TrendingUp, label: "收入" },
  { to: "/predict", icon: LineChart, label: "预测" },
  { to: "/weekly", icon: FileText, label: "周报" },
  { to: "/goals", icon: Target, label: "目标" },
  { to: "/analytics", icon: BarChart3, label: "看板" },
  { to: "/achievements", icon: Award, label: "成就" },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 glass-nav pb-safe">
      <div className="flex items-center justify-around max-w-lg mx-auto h-16 px-0.5">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 h-full transition-colors ${
                isActive ? "text-[#FFD100]" : "text-white/40 hover:text-white/60"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className="relative">
                  <item.icon size={17} strokeWidth={isActive ? 2.5 : 1.5} />
                  {isActive && (
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#FFD100]" />
                  )}
                </div>
                <span className="text-[9px] font-medium leading-none">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}