import { useRef, useEffect, useState, memo } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  CalendarDays,
  TrendingUp,
  LineChart,
  LayoutGrid,
  FileText,
  Target,
  BarChart3,
  Sparkles,
  Award,
  Settings,
} from "lucide-react";
import { prefetchPage } from "@/utils/prefetch";
import BottomSheet from "@/components/shared/BottomSheet";
import { useTheme } from "@/hooks/useTheme";

interface NavItem {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  badge?: number;
  badgeDot?: boolean;
  prefetch?: () => Promise<unknown>;
}

const mainItems: NavItem[] = [
  { to: "/", icon: LayoutDashboard, label: "仪表盘" },
  { to: "/records", icon: CalendarDays, label: "记录", prefetch: prefetchPage.records },
  { to: "/income", icon: TrendingUp, label: "收入", prefetch: prefetchPage.income },
  { to: "/predict", icon: LineChart, label: "预测", prefetch: prefetchPage.predict },
];

const moreItems: NavItem[] = [
  { to: "/weekly", icon: FileText, label: "周报", prefetch: prefetchPage.weekly },
  { to: "/goals", icon: Target, label: "目标", prefetch: prefetchPage.goals },
  { to: "/analytics", icon: BarChart3, label: "看板", prefetch: prefetchPage.analytics },
  { to: "/whatif", icon: Sparkles, label: "反事实", prefetch: prefetchPage.whatif },
  { to: "/achievements", icon: Award, label: "成就", prefetch: prefetchPage.achievements },
  { to: "/settings", icon: Settings, label: "设置", prefetch: prefetchPage.settings },
];

const morePaths = new Set(moreItems.map((i) => i.to));

function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const navRef = useRef<HTMLDivElement>(null);
  const [glowStyle, setGlowStyle] = useState({ left: 0, width: 0, opacity: 0 });
  const [moreOpen, setMoreOpen] = useState(false);
  const { isIOS } = useTheme();

  const activeIndex = mainItems.findIndex((i) => i.to === location.pathname);
  const isMoreActive = morePaths.has(location.pathname);

  // 活动项发光跟踪 - 减少计算开销
  useEffect(() => {
    const idx = activeIndex >= 0 ? activeIndex : isMoreActive ? 4 : -1;
    if (idx < 0 || !navRef.current) {
      setGlowStyle((s) => ({ ...s, opacity: 0 }));
      return;
    }
    const navItems = navRef.current.querySelectorAll<HTMLElement>("[data-nav-item]");
    const target = navItems[idx];
    if (target) {
      const navRect = navRef.current.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      setGlowStyle({
        left: targetRect.left - navRect.left + targetRect.width / 2 - 24,
        width: 48,
        opacity: 1,
      });
    }
  }, [activeIndex, isMoreActive]);

  // 空闲时预加载所有非首屏页面，让后续导航秒开
  useEffect(() => {
    const id = setTimeout(() => {
      Object.values(prefetchPage).forEach((fn) => {
        try { fn(); } catch { /* ignore */ }
      });
    }, 2500);
    return () => clearTimeout(id);
  }, []);

  const renderIOSMainItem = (item: NavItem) => (
    <NavLink
      key={item.to}
      to={item.to}
      data-nav-item
      onPointerEnter={() => item.prefetch?.()}
      onTouchStart={() => item.prefetch?.()}
      className={({ isActive }) =>
        `flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 h-full transition-colors ${
          isActive ? "text-[#007AFF]" : "text-[#8E8E93]"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <div className="relative">
            <item.icon size={22} strokeWidth={isActive ? 2.2 : 1.6} />
            {item.badge && (
              <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-[#FF3B30] text-white text-[9px] font-bold flex items-center justify-center">
                {item.badge > 99 ? "99+" : item.badge}
              </span>
            )}
            {item.badgeDot && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#FF3B30]" />}
          </div>
          <span className="text-[10px] font-medium leading-none">{item.label}</span>
        </>
      )}
    </NavLink>
  );

  const renderCyberMainItem = (item: NavItem) => (
    <NavLink
      key={item.to}
      to={item.to}
      data-nav-item
      onPointerEnter={() => item.prefetch?.()}
      onTouchStart={() => item.prefetch?.()}
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
              size={18}
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
            {item.badge && (
              <span className="nav-badge">{item.badge > 99 ? "99+" : item.badge}</span>
            )}
            {item.badgeDot && <span className="nav-badge-dot" />}
          </div>
          <span
            className={`text-[10px] font-medium leading-none tracking-wider transition-all duration-300 ${
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
  );

  if (isIOS) {
    return (
      <>
        <nav className="ios-tab-bar">
          <div
            ref={navRef}
            className="flex items-center justify-around max-w-lg mx-auto h-[48px] px-2"
          >
            {mainItems.map(renderIOSMainItem)}
            <button
              data-nav-item
              onClick={() => setMoreOpen(true)}
              onPointerEnter={() => moreItems.forEach((i) => i.prefetch?.())}
              className={`flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 h-full transition-colors ${
                isMoreActive ? "text-[#007AFF]" : "text-[#8E8E93]"
              }`}
            >
              <LayoutGrid size={22} strokeWidth={isMoreActive ? 2.2 : 1.6} />
              <span className="text-[10px] font-medium leading-none">更多</span>
            </button>
          </div>
        </nav>

        <BottomSheet isOpen={moreOpen} onClose={() => setMoreOpen(false)} title="更多功能" ios>
          <div className="grid grid-cols-3 gap-3">
            {moreItems.map((item) => (
              <button
                key={item.to}
                onClick={() => {
                  navigate(item.to);
                  setMoreOpen(false);
                }}
                onPointerEnter={() => item.prefetch?.()}
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl transition-all active:scale-95 active:opacity-80 ${
                  location.pathname === item.to
                    ? "bg-[#007AFF]/12 text-[#007AFF]"
                    : "bg-[#F2F2F7] text-[#000000]"
                }`}
              >
                <item.icon size={24} strokeWidth={1.8} />
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            ))}
          </div>
        </BottomSheet>
      </>
    );
  }

  return (
    <>
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
            className="flex items-center justify-around max-w-lg mx-auto h-[62px] px-2 relative"
          >
            {/* 主入口 */}
            {mainItems.map(renderCyberMainItem)}

            {/* 更多入口 */}
            <button
              data-nav-item
              onClick={() => setMoreOpen(true)}
              onPointerEnter={() => moreItems.forEach((i) => i.prefetch?.())}
              className={`flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 h-full transition-all duration-300 tap-cyber nav-tap-haptic ${
                isMoreActive ? "nav-cyber-active" : ""
              }`}
            >
              <div className="relative">
                <LayoutGrid
                  size={18}
                  strokeWidth={isMoreActive ? 2.5 : 1.5}
                  className={`transition-all duration-300 ${
                    isMoreActive ? "text-[#00E5FF]" : "text-[#E0E0E0]/25"
                  }`}
                  style={
                    isMoreActive
                      ? { filter: "drop-shadow(0 0 8px rgba(0,229,255,0.5))" }
                      : undefined
                  }
                />
                {isMoreActive && (
                  <div
                    className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                    style={{
                      background: "radial-gradient(circle, #00E5FF, #00B0D0)",
                      boxShadow: "0 0 8px rgba(0,229,255,0.6)",
                    }}
                  />
                )}
              </div>
              <span
                className={`text-[10px] font-medium leading-none tracking-wider transition-all duration-300 ${
                  isMoreActive ? "text-[#00E5FF]" : "text-[#E0E0E0]/25"
                }`}
                style={
                  isMoreActive ? { textShadow: "0 0 8px rgba(0,229,255,0.4)" } : undefined
                }
              >
                更多
              </span>
            </button>
          </div>
        </div>
      </nav>

      <BottomSheet isOpen={moreOpen} onClose={() => setMoreOpen(false)} title="更多功能">
        <div className="grid grid-cols-3 gap-3">
          {moreItems.map((item) => (
            <button
              key={item.to}
              onClick={() => {
                navigate(item.to);
                setMoreOpen(false);
              }}
              onPointerEnter={() => item.prefetch?.()}
              className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all tap-cyber ${
                location.pathname === item.to
                  ? "bg-[#00E5FF]/10 border-[#00E5FF]/30 text-[#00E5FF]"
                  : "bg-[#00E5FF]/3 border-[#00E5FF]/8 text-[#E0E0E0]/70 hover:bg-[#00E5FF]/8 hover:border-[#00E5FF]/20"
              }`}
            >
              <item.icon
                size={22}
                strokeWidth={1.8}
                className={
                  location.pathname === item.to ? "text-[#00E5FF]" : "text-[#E0E0E0]/50"
                }
              />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}

export default memo(BottomNav);
