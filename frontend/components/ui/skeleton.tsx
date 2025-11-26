"use client";

/**
 * Skeleton Loading Components
 *
 * Provides shimmer animation placeholders for loading states.
 */

import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

/**
 * Base skeleton with shimmer animation
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-gradient-to-r from-white/5 via-white/10 to-white/5 bg-[length:200%_100%]",
        className
      )}
    />
  );
}

/**
 * Text skeleton - mimics a line of text
 */
export function SkeletonText({ className }: SkeletonProps) {
  return <Skeleton className={cn("h-4 w-full", className)} />;
}

/**
 * Title skeleton - larger text
 */
export function SkeletonTitle({ className }: SkeletonProps) {
  return <Skeleton className={cn("h-6 w-3/4", className)} />;
}

/**
 * Button skeleton
 */
export function SkeletonButton({ className }: SkeletonProps) {
  return <Skeleton className={cn("h-10 w-24 rounded-xl", className)} />;
}

/**
 * Card skeleton - full card placeholder
 */
export function SkeletonCard({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3",
        className
      )}
    >
      <SkeletonTitle />
      <SkeletonText className="w-1/2" />
      <div className="flex gap-2 pt-2">
        <SkeletonButton />
        <SkeletonButton className="w-16" />
      </div>
    </div>
  );
}

/**
 * Event card skeleton
 */
export function SkeletonEventCard() {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-9 w-24 rounded-xl" />
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-white/5 bg-white/5 p-3 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-full rounded-lg mt-2" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Pass card skeleton
 */
export function SkeletonPassCard() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-48" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-7 w-20 rounded-lg" />
          <Skeleton className="h-7 w-20 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/**
 * Stats grid skeleton
 */
export function SkeletonStats() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2"
        >
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-24" />
        </div>
      ))}
    </div>
  );
}

/**
 * Table row skeleton
 */
export function SkeletonTableRow() {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/5">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="space-y-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="h-4 w-16" />
    </div>
  );
}
