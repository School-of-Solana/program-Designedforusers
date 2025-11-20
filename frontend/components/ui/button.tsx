import { ButtonHTMLAttributes } from "react";
import { twMerge } from "tailwind-merge";

export const Button = ({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    className={twMerge(
      "inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60",
      className
    )}
    {...props}
  />
);
