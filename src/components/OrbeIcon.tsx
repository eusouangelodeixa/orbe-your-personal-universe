import { cn } from "@/lib/utils";

interface OrbeIconProps {
  className?: string;
  size?: number;
}

export function OrbeIcon({ className, size = 32 }: OrbeIconProps) {
  return (
    <div
      className={cn(
        "relative rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center",
        className
      )}
      style={{ width: size, height: size }}
    >
      <div
        className="absolute rounded-full bg-gradient-to-br from-primary/60 to-accent/60 animate-pulse-glow"
        style={{ width: size * 1.3, height: size * 1.3, top: -(size * 0.15), left: -(size * 0.15) }}
      />
      <div
        className="relative rounded-full bg-gradient-to-br from-primary to-accent"
        style={{ width: size * 0.85, height: size * 0.85 }}
      >
        <div
          className="absolute rounded-full bg-background/20"
          style={{ width: size * 0.3, height: size * 0.3, top: size * 0.12, left: size * 0.15 }}
        />
      </div>
    </div>
  );
}
