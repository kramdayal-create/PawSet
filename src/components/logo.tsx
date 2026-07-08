import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

function LogoMark({ className, gradient = false }: { className?: string; gradient?: boolean }) {
  const id = React.useId();
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {gradient && (
        <defs>
          <linearGradient id={id} x1="4" y1="3" x2="28" y2="29" gradientUnits="userSpaceOnUse">
            <stop stopColor="hsl(162 84% 33%)" />
            <stop offset="0.55" stopColor="hsl(176 80% 35%)" />
            <stop offset="1" stopColor="hsl(199 90% 46%)" />
          </linearGradient>
        </defs>
      )}
      <path
        d="M6.5 5C6.5 3.6 7.6 2.5 9 2.5H19L25.5 9V27C25.5 28.4 24.4 29.5 23 29.5H9C7.6 29.5 6.5 28.4 6.5 27V5Z"
        fill={gradient ? `url(#${id})` : "currentColor"}
        className={gradient ? undefined : "text-current"}
      />
      <path
        d="M19 2.5L25.5 9H20.5C19.7 9 19 8.3 19 7.5V2.5Z"
        fill="#ffffff"
        fillOpacity="0.35"
      />
      <path
        d="M11.5 17.5L14.5 20.5L20.5 13.5"
        stroke="#ffffff"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface LogoProps {
  href?: string;
  size?: "sm" | "default" | "lg";
  /** "light" renders a white wordmark for use on the deep-navy chrome. */
  tone?: "default" | "light";
  className?: string;
}

export function DocChaseLogo({ href = "/", size = "default", tone = "default", className }: LogoProps) {
  const sizes = {
    sm:      { icon: "h-5 w-5",  text: "text-base"  },
    default: { icon: "h-6 w-6",  text: "text-lg"    },
    lg:      { icon: "h-8 w-8",  text: "text-2xl"   },
  };
  const s = sizes[size];

  return (
    <Link
      href={href}
      className={cn("flex items-center gap-2 transition-opacity hover:opacity-85", className)}
    >
      <LogoMark
        className={cn(s.icon, tone === "light" && "text-white")}
        gradient={tone === "default"}
      />
      <span
        className={cn(
          s.text,
          "font-bold tracking-tight",
          tone === "light" ? "text-white" : "text-foreground",
        )}
      >
        DocChase
      </span>
    </Link>
  );
}
