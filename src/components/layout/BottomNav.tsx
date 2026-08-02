import { useRef, useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  CalendarDays,
  TrendingUp,
  LineChart,
  FileText,
  Target,
  BarChart3,
  Award,
} from "lucide-react";

interface NavItem {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  badge?: number;
  badgeDot?: boolean;
}

const leftItems: NavItem[] = [
  { to: "/", icon: LayoutDashboard, label: "仪表盘" },
  { to: "/records", icon: CalendarDays, label: "记录" },
  { to: "/income", icon: TrendingUp, label: "收入" },
  { to: "/predict", icon: LineChart, label: "预测", badge: 3 },
];

const rightItems: NavItem[] = [
  { to: "/weekly", icon: FileText, label: "周报", badgeDot: true },
  { to: "/goals", icon: Target, label: "目标" },
  { to: "/analytics", icon: BarChart3, label: "看板" },
  { to: "/achievements", icon: Award, label: "成就" },
];

function useActiveIndex(items: { to: string }[], offset: number) {
  const location = useLocation();
  const idx = items.findIndex((item) => item.to === location.pathname);
  return idx >= 0 ? idx + offset : -1;
}

export default function BottomNav() {
  const navRef = useRef<HTMLDivElement>(null);
  const [glowStyle, setGlowStyle] = useState<{ left: number; width: number; opacity: number }>({
    left: 0,
    width: 0,
    opacity: 0,
  });
  const leftActiveIdx = useActiveIndex(leftItems, 0);
  const rightActiveIdx = useActiveIndex(rightItems, 4); // 左侧4项

  const activeIdx = leftActiveIdx >= 0 ? leftActiveIdx : rightActiveIdx;

  // 简化发光跟踪 - 减少计算开销
  useEffect(() => {
    if (activeIdx < 0 || !navRef.current) {
      setGlowStyle((s) => ({ ...s, opacity: 0 }));
      return;
    }
    const navItems = navRef.current.querySelectorAll<HTMLElement>("[data-nav-item]");
    const target = navItems[activeIdx];
    if (target) {
      const navRect = navRef.current.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      setGlowStyle({
        left: targetRect.left - navRect.left + targetRect.width / 2 - 24,
        width: 48,
        opacity: 1,
      });
    }
  }, [activeIdx]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30">
      <div className="cyber-nav relative overflow-visible">
        {/* 活动项发光跟踪指示器 */}
        <div
          className="nav-glow-tracker"
          style={{
            left: `${glowStyle.left}px`,
            width: `${glowStyle.width}px`,
            opacity: glowStyle.opacity,
          }}
        />

        <div
          ref={navRef}
          className="flex items-center justify-around max-w-lg mx-auto h-[62px] px-1 relative"
        >
          {/* 左侧导航项 */}
          {leftItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              data-nav-item
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 h-full transition-all duration-300 tap-cyber nav-tap-haptic ${
                  isActive ? "nav-cyber-active" : ""
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="relative">
                    <item.icon
                      size={16}
                      strokeWidth={isActive ? 2.5 : 1.5}
                      className={`transition-all duration-300 ${
                        isActive ? "text-[#00E5FF]" : "text-[#E0E0E0]/25"
                      }`}
                      style={
                        isActive
                          ? { filter: "drop-shadow(0 0 8px rgba(0,229,255,0.5))" }
                          : undefined
                      }
                    />
                    {isActive && (
                      <div
                        className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                        style={{
                          background: "radial-gradient(circle, #00E5FF, #00B0D0)",
                          boxShadow: "0 0 8px rgba(0,229,255,0.6)",
                        }}
                      />
                    )}
                    {/* 徽章 */}
                    {item.badge && (
                      <span className="nav-badge">{item.badge > 99 ? "99+" : item.badge}</span>
                    )}
                    {item.badgeDot && <span className="nav-badge-dot" />}
                  </div>
                  <span
                    className={`text-[9px] font-medium leading-none tracking-wider transition-all duration-300 ${
                      isActive ? "text-[#00E5FF]" : "text-[#E0E0E0]/25"
                    }`}
                    style={
                      isActive ? { textShadow: "0 0 8px rgba(0,229,255,0.4)" } : undefined
                    }
                  >
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}

          {/* 右侧导航项 */}
          {rightItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              data-nav-item
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 h-full transition-all duration-300 tap-cyber nav-tap-haptic ${
                  isActive ? "nav-cyber-active" : ""
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="relative">
                    <item.icon
                      size={16}
                      strokeWidth={isActive ? 2.5 : 1.5}
                      className={`transition-all duration-300 ${
                        isActive ? "text-[#00E5FF]" : "text-[#E0E0E0]/25"
                      }`}
                      style={
                        isActive
                          ? { filter: "drop-shadow(0 0 8px rgba(0,229,255,0.5))" }
                          : undefined
                      }
                    />
                    {isActive && (
                      <div
                        className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                        style={{
                          background: "radial-gradient(circle, #00E5FF, #00B0D0)",
                          boxShadow: "0 0 8px rgba(0,229,255,0.6)",
                        }}
                      />
                    )}
                    {/* 徽章 */}
                    {item.badge && (
                      <span className="nav-badge">{item.badge > 99 ? "99+" : item.badge}</span>
                    )}
                    {item.badgeDot && <span className="nav-badge-dot" />}
                  </div>
                  <span
                    className={`text-[9px] font-medium leading-none tracking-wider transition-all duration-300 ${
                      isActive ? "text-[#00E5FF]" : "text-[#E0E0E0]/25"
                    }`}
                    style={
                      isActive ? { textShadow: "0 0 8px rgba(0,229,255,0.4)" } : undefined
                    }
                  >
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}