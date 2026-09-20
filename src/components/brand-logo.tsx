import { Link } from "@tanstack/react-router";

export function BrandMark({ className = "size-10" }: { className?: string }) {
  return (
    <span className={`relative grid shrink-0 place-items-center ${className}`} aria-hidden="true">
      <span className="absolute inset-[8%] rotate-45 rounded-[28%] bg-primary/20" />
      <svg viewBox="0 0 24 24" className="relative size-[62%] fill-none text-primary" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 3h5v5" />
        <path d="M8 21H3v-5" />
        <path d="m21 3-7 7" />
        <path d="m3 21 7-7" />
        <circle cx="12" cy="12" r="3" className="text-foreground" />
      </svg>
    </span>
  );
}

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" aria-label="SkillEarn Assam home" className="flex min-w-0 items-center gap-2.5">
      <BrandMark />
      {!compact && <span className="min-w-0 font-display leading-none">
        <strong className="block truncate text-lg font-bold">Skill<span className="text-primary">Earn</span></strong>
        <span className="mt-1 block text-[9px] font-semibold uppercase text-primary">Assam</span>
      </span>}
    </Link>
  );
}