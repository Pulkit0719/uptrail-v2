import { cn } from "@/lib/utils";

export function UptrailLogo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)} aria-label="Uptrail">
      <div className="grid size-9 place-items-center rounded-xl bg-[#18302F] shadow-[0_8px_18px_rgba(24,48,47,0.16)]">
        <svg viewBox="0 0 32 32" className="size-5 text-[#F4D793]" fill="none" aria-hidden="true">
          <path d="M7.5 23.5c5.2-1 8.5-4.8 10.1-11.8 3.2 2.2 5.2 5.2 6 8.9" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8 13.6c2.2 3 5.3 5.2 9.2 6.4" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      </div>
      {!compact && <span className="font-display text-[1.28rem] font-semibold tracking-[-0.045em] text-[#18302F]">uptrail</span>}
    </div>
  );
}

