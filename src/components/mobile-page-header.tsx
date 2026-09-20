import { BrandMark } from "@/components/brand-logo";

export function MobilePageHeader({ title }: { title: string }) {
  return <header className="sticky top-0 z-30 border-b border-glass-border bg-background/90 px-4 py-3 backdrop-blur-xl sm:px-8"><div className="mx-auto flex max-w-4xl items-center gap-3"><BrandMark /><div className="min-w-0"><p className="text-[10px] font-semibold uppercase text-primary">SkillEarn Assam</p><h1 className="truncate font-display text-lg font-bold">{title}</h1></div></div></header>;
}