import { Info, AlertTriangle, Lightbulb, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface CalloutProps {
  type?: "info" | "warning" | "tip" | "danger";
  title?: string;
  children: React.ReactNode;
}

const calloutConfig = {
  info: {
    icon: Info,
    className: "border-blue-500/50 bg-blue-500/10",
    iconClassName: "text-blue-500",
  },
  warning: {
    icon: AlertTriangle,
    className: "border-yellow-500/50 bg-yellow-500/10",
    iconClassName: "text-yellow-500",
  },
  tip: {
    icon: Lightbulb,
    className: "border-green-500/50 bg-green-500/10",
    iconClassName: "text-green-500",
  },
  danger: {
    icon: AlertCircle,
    className: "border-red-500/50 bg-red-500/10",
    iconClassName: "text-red-500",
  },
};

export function Callout({ type = "info", title, children }: CalloutProps) {
  const config = calloutConfig[type];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "my-6 flex gap-3 rounded-lg border p-4",
        config.className
      )}
    >
      <Icon className={cn("h-5 w-5 mt-0.5 shrink-0", config.iconClassName)} />
      <div className="flex-1">
        {title && (
          <p className="font-semibold text-foreground mb-1">{title}</p>
        )}
        <div className="text-sm text-muted-foreground [&>p]:mt-0">
          {children}
        </div>
      </div>
    </div>
  );
}
