import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { SiteHeader } from "@/components/SiteHeader";
import { getArticleBySlug } from "@/lib/data";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) return { title: "教程未找到 · " + site.name };
  return {
    title: `${article.title} · ${site.name}`,
    description: article.summary || undefined,
  };
}

// react-markdown 默认不渲染原始 HTML（未启用 rehype-raw），从源头杜绝 XSS。
// 这里只为各标签套上与站点设计令牌一致的 Tailwind 类。
const md = {
  h1: (p: React.ComponentProps<"h1">) => (
    <h2 className="mt-10 text-2xl font-bold tracking-tight" {...p} />
  ),
  h2: (p: React.ComponentProps<"h2">) => (
    <h2 className="mt-10 border-b border-line pb-2 text-xl font-semibold tracking-tight" {...p} />
  ),
  h3: (p: React.ComponentProps<"h3">) => (
    <h3 className="mt-8 text-lg font-semibold tracking-tight" {...p} />
  ),
  p: (p: React.ComponentProps<"p">) => (
    <p className="mt-4 text-[15px] leading-7 text-ink/90" {...p} />
  ),
  ul: (p: React.ComponentProps<"ul">) => (
    <ul className="mt-4 list-disc space-y-1.5 pl-6 text-[15px] leading-7 text-ink/90" {...p} />
  ),
  ol: (p: React.ComponentProps<"ol">) => (
    <ol className="mt-4 list-decimal space-y-1.5 pl-6 text-[15px] leading-7 text-ink/90" {...p} />
  ),
  a: ({ href, ...rest }: React.ComponentProps<"a">) => {
    const external = typeof href === "string" && /^https?:\/\//i.test(href);
    return (
      <a
        href={href}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className="text-accent underline underline-offset-2 hover:opacity-80"
        {...rest}
      />
    );
  },
  img: ({ alt, ...rest }: React.ComponentProps<"img">) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={alt ?? ""}
      loading="lazy"
      className="mt-5 w-full rounded-card border border-line"
      {...rest}
    />
  ),
  blockquote: (p: React.ComponentProps<"blockquote">) => (
    <blockquote className="mt-4 border-l-2 border-accent/50 bg-surface py-1 pl-4 text-[15px] text-muted" {...p} />
  ),
  code: (p: React.ComponentProps<"code">) => (
    <code className="rounded bg-sunken px-1.5 py-0.5 font-mono text-[13px] text-ink" {...p} />
  ),
  pre: (p: React.ComponentProps<"pre">) => (
    <pre className="mt-4 overflow-x-auto rounded-card border border-line bg-sunken p-4 font-mono text-[13px] leading-6" {...p} />
  ),
  hr: () => <hr className="mt-8 border-line" />,
};

export default async function GuidePage({ params }: Params) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) notFound();

  return (
    <>
      <SiteHeader />

      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-5 py-14 sm:py-20">
          <Link
            href="/#guides"
            className="font-mono text-[13px] text-muted transition-colors hover:text-ink"
          >
            ← 返回教程
          </Link>

          <header className="mt-6 border-b border-line pb-7">
            <span className="rounded-full border border-line bg-surface px-2.5 py-0.5 font-mono text-[11px] text-muted">
              {article.tag}
            </span>
            <h1 className="mt-4 text-[2rem] font-bold leading-tight tracking-[-0.01em] sm:text-[2.5rem]">
              {article.title}
            </h1>
            {article.summary && (
              <p className="mt-4 text-[15px] leading-relaxed text-muted">
                {article.summary}
              </p>
            )}
          </header>

          <div className="mt-2">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={md}>
              {article.content}
            </ReactMarkdown>
          </div>
        </article>
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-8">
          <Link href="/" className="text-sm font-semibold hover:text-accent">
            {site.name}
          </Link>
          <Link
            href="/#guides"
            className="font-mono text-[12px] text-muted hover:text-ink"
          >
            更多教程 →
          </Link>
        </div>
      </footer>
    </>
  );
}
