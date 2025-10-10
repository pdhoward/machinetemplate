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
  // NEW imports
  MdxTable, MdxThead, MdxTbody, MdxTr, MdxTh, MdxTd,
} from "@/components/docs/mdx-parts";
import DocsHeaderBar from "@/components/docs/DocsHeaderBar";

const components = {
  // Typography
  h1: (p: any) => <h1 {...p} className="mb-4 text-4xl font-bold tracking-tight" />,
  h2: (p: any) => <h2 {...p} className="mt-10 mb-4 border-b pb-1 text-2xl font-semibold" />,
  h3: (p: any) => <h3 {...p} className="mt-8 mb-2 text-xl font-semibold" />,
  p:  (p: any) => <p  {...p} className="leading-7 [&:not(:first-child)]:mt-4" />,
  ul: (p: any) => <ul {...p} className="my-4 ml-6 list-disc space-y-1" />,
  ol: (p: any) => <ol {...p} className="my-4 ml-6 list-decimal space-y-1" />,
  li: (p: any) => <li {...p} className="leading-7" />,

  // Links / misc
  a:  (p: any) => (
    <a
      {...p}
      className="font-medium underline underline-offset-4 hover:text-primary"
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

  // Optional shadcn stuff in MDX
  Card, CardHeader, CardTitle, CardDescription, CardContent, Badge,
} as const;

export default async function DocsPage() {
  const source = await fetchPrivateGithubFileRaw({
    owner: "pdhoward",
    repo: "machinetemplate",
    path: "Instructions.mdx",
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted text-foreground">
      <DocsHeaderBar
      githubUrl="https://github.com/pdhoward/machinetemplate/blob/main/Instructions.mdx"
      subtitle="Instructions"
    />
      <main className="mx-auto max-w-3xl px-4 py-10">
       <article
        className="prose prose-zinc dark:prose-invert max-w-none
          prose-headings:scroll-mt-20
          prose-h2:mt-12 prose-h2:pb-1 prose-h2:border-b
          prose-th:whitespace-nowrap"
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
      </main>
    </div>
  );
}
