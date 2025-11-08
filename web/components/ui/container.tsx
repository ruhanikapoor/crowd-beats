import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Container({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-full h-full md:container md:mx-auto overflow-x-hidden px-4",
        className
      )}
    >
      {children}
    </div>
  );
}
