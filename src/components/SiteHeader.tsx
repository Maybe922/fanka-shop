import Link from "next/link";
import { site } from "@/lib/site";

export function SiteHeader() {
  return (
    <header className="border-b border-line/80">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-lg font-semibold tracking-tight">{site.name}</span>
          <span className="hidden text-sm text-muted sm:inline">{site.tagline}</span>
        </Link>
        <nav className="flex items-center gap-5 text-sm text-muted">
          <a href="/#how" className="transition-colors hover:text-ink">
            购买流程
          </a>
          <a href="/#faq" className="transition-colors hover:text-ink">
            常见问题
          </a>
        </nav>
      </div>
    </header>
  );
}
