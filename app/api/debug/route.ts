// app/api/debug-mdx/route.ts
import { NextResponse } from "next/server";
import { compile } from "@mdx-js/mdx";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeExternalLinks from "rehype-external-links";
import { fetchPrivateGithubFileRaw } from "@/lib/github";

export async function GET() {
  try {
    const source = await fetchPrivateGithubFileRaw({
      owner: "pdhoward",
      repo: "machinetemplate",
      path: "Instructions.mdx",
    });

    console.log(source)

    // Try compiling *exactly* like your page does
    const file = await compile(source, {
      // Helpful for error positions
      format: "mdx",
      development: true,
      remarkPlugins: [remarkGfm],
      rehypePlugins: [
        rehypeSlug,
        [rehypeAutolinkHeadings, { behavior: "wrap" }],
        [rehypeExternalLinks, { target: "_blank", rel: ["noopener", "noreferrer"] }],
      ],
    });

    return NextResponse.json({ ok: true, bytes: String(file).length });
  } catch (err: any) {
    // MDX errors usually have position {start:{line,column}, end:{...}}
    const pos = err?.position ?? err?.loc ?? null;
    const reason = err?.reason ?? err?.message ?? "Unknown MDX error";
    return NextResponse.json(
      { ok: false, reason, position: pos, raw: String(err?.message || err) },
      { status: 500 }
    );
  }
}
