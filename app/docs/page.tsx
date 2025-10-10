// app/docs/page.tsx
import React from "react";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeExternalLinks from "rehype-external-links";
import { fetchPrivateGithubFileRaw } from "@/lib/github";
import {
  Pre, InlineCode, StepCard, Callout,
  Card, CardHeader, CardTitle, CardDescription, CardContent,
  Badge, Separator,
  MdxTable, MdxThead, MdxTbody, MdxTr, MdxTh, MdxTd,
} from "@/components/docs/mdx-parts";
import DocsHeaderBar from "@/components/docs/DocsHeaderBar";
import BackToTop from "@/components/docs/BackToTop"; 

const components = {
  // Typography (tweak sizes responsively)
  h1: (p: any) => <h1 {...p} className="mb-3 text-2xl sm:text-4xl font-bold tracking-tight" />,
  h2: (p: any) => <h2 {...p} className="mt-8 sm:mt-10 mb-3 border-b pb-1 text-lg sm:text-2xl font-semibold" />,
  h3: (p: any) => <h3 {...p} className="mt-6 sm:mt-8 mb-2 text-base sm:text-xl font-semibold" />,
  p:  (p: any) => <p  {...p} className="leading-7 break-words [&:not(:first-child)]:mt-4" />,
  ul: (p: any) => <ul {...p} className="my-4 ml-5 sm:ml-6 list-disc space-y-1" />,
  ol: (p: any) => <ol {...p} className="my-4 ml-5 sm:ml-6 list-decimal space-y-1" />,
  li: (p: any) => <li {...p} className="leading-7" />,

  // Links / misc
  a:  (p: any) => (
    <a
      {...p}
      className="break-words font-medium underline underline-offset-4 hover:text-primary"
      target={p.href?.startsWith("http") ? "_blank" : undefined}
      rel={p.href?.startsWith("http") ? "noopener noreferrer" : undefined}
    />
  ),
  hr: () => <Separator className="my-8" />,
  blockquote: (props: any) => (<Callout title="Note">{props.children}</Callout>),
  pre: Pre,
  code: InlineCode,

  // Custom shortcodes
  StepCard,
  Callout,

  // Styled markdown tables
  table: MdxTable,
  thead: MdxThead,
  tbody: MdxTbody,
  tr: MdxTr,
  th: MdxTh,
  td: MdxTd,

  // Optional shadcn pieces
  Card, CardHeader, CardTitle, CardDescription, CardContent, Badge,
} as const;

export default async function DocsPage() {
  const source = await fetchPrivateGithubFileRaw({
    owner: "pdhoward",
    repo: "machinetemplate",
    path: "Instructions.mdx",
  });

  return (
   <div className="min-h-screen w-full overflow-x-hidden bg-gradient-to-b from-background to-muted text-foreground">
      <DocsHeaderBar
        githubUrl="https://github.com/pdhoward/machinetemplate/blob/main/Instructions.mdx"
        subtitle="Instructions"
      />

      {/* page container */}
      <main className="mx-auto w-full max-w-3xl px-3 sm:px-4 md:px-6 py-6 sm:py-8 md:py-10">
        {/* note: prose sizes scale by breakpoint; headings keep scroll offset for the sticky header */}
        <article
          className={[
            "prose max-w-none",
            "prose-zinc dark:prose-invert",
            "prose-xs sm:prose-base md:prose-lg",      // ↓ smaller on mobile
            "prose-headings:scroll-mt-24",
            "sm:prose-h2:mt-12 sm:prose-h2:pb-1 sm:prose-h2:border-b",
            "sm:prose-th:whitespace-nowrap",           // wrap table headers on mobile
            "prose-code:break-words prose-pre:text-xs sm:prose-pre:text-sm",
            "prose-a:break-words",
          ].join(" ")}
        >

          <MDXRemote
            source={source}
            components={components}
            options={{
              mdxOptions: {
                remarkPlugins: [remarkGfm],
                rehypePlugins: [
                  rehypeSlug,
                  [rehypeAutolinkHeadings, { behavior: "wrap" }],
                  [rehypeExternalLinks, { target: "_blank", rel: ["noopener", "noreferrer"] }],
                ],
              },
            }}
          />
        </article>

        {/* mobile-only back-to-top */}
        <BackToTop />
      </main>

      {/* give iOS a bit of safe-area breathing room */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </div>
  );
}
