import { ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

interface IOSListProps {
  children: React.ReactNode;
  className?: string;
}

export function IOSList({ children, className = "" }: IOSListProps) {
  return (
    <div
      className={`ios-list ${className}`}
      style={{
        background: "var(--ios-grouped-secondary)",
        boxShadow: "var(--ios-shadow-xs)",
      }}
    >
      {children}
    </div>
  );
}

interface IOSListItemProps {
  label: React.ReactNode;
  value?: React.ReactNode;
  icon?: React.ReactNode;
  chevron?: boolean;
  onClick?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export function IOSListItem({
  label,
  value,
  icon,
  chevron = false,
  onClick,
  className = "",
  children,
}: IOSListItemProps) {
  const Comp = onClick ? motion.button : "div";

  return (
    <Comp
      onClick={onClick}
      className={`ios-list-item ${className}`}
      style={{
        borderBottom: "0.5px solid var(--ios-separator)",
        background: "transparent",
      }}
      whileTap={onClick ? { backgroundColor: "var(--ios-fill)" } : undefined}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {icon && (
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "var(--ios-fill-secondary)" }}
          >
            {icon}
          </div>
        )}
        <span
          className="truncate"
          style={{
            color: "var(--ios-label)",
            fontSize: "var(--ios-text-body)",
          }}
        >
          {label}
        </span>
      </div>
      {children}
      {value !== undefined && (
        <span
          className="truncate text-right"
          style={{
            color: "var(--ios-label-secondary)",
            fontSize: "var(--ios-text-body)",
          }}
        >
          {value}
        </span>
      )}
      {chevron && (
        <ChevronRight size={18} style={{ color: "var(--ios-system-gray3)" }} />
      )}
    </Comp>
  );
}

interface IOSListSectionProps {
  title?: string;
  footer?: string;
  children: React.ReactNode;
}

export function IOSListSection({ title, footer, children }: IOSListSectionProps) {
  return (
    <div className="mt-6">
      {title && (
        <h4
          className="px-1 mb-2"
          style={{
            color: "var(--ios-label-secondary)",
            fontSize: "var(--ios-text-footnote)",
            fontWeight: 400,
            textTransform: "uppercase",
            letterSpacing: "0.02em",
          }}
        >
          {title}
        </h4>
      )}
      {children}
      {footer && (
        <p
          className="px-1 mt-2"
          style={{
            color: "var(--ios-label-secondary)",
            fontSize: "var(--ios-text-footnote)",
            lineHeight: 1.4,
          }}
        >
          {footer}
        </p>
      )}
    </div>
  );
}
