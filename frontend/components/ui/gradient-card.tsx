import { PropsWithChildren } from "react";
import { twMerge } from "tailwind-merge";

export const GradientCard = ({ children, className = "" }: PropsWithChildren<{ className?: string }>) => (
  <div
    className={twMerge(
      "rounded-3xl border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-6 shadow-[0_20px_45px_rgba(8,8,21,0.45)] backdrop-blur-xl",
      className
    )}
  >
    {children}
  </div>
);
