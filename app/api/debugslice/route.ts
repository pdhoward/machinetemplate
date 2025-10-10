// app/api/debug-mdx-bisect/route.ts
import { NextResponse } from "next/server";
import { compile } from "@mdx-js/mdx";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeExternalLinks from "rehype-external-links";
import { fetchPrivateGithubFileRaw } from "@/lib/github";

function looksRiskyBlock(src: string) {
  const risky: Record<string, boolean> = {
    jsxStepCard: /<StepCard[\s>]/.test(src),
    jsxCallout: /<Callout[\s>]/.test(src),
    listInJsx: /<([A-Z][A-Za-z0-9]*)[\s\S]*?\n\s*[-*]\s+/m.test(src),
    tableInJsx: /<([A-Z][A-Za-z0-9]*)[\s\S]*?\n\s*\|.*\|\s*$/m.test(src),
    fenceInJsx: /<([A-Z][A-Za-z0-9]*)[\s\S]*?```/m.test(src),
  };
  return risky;
}

async function mdxOk(s: string) {
  try {
    await compile(s, {
      format: "mdx",
      development: true,
      remarkPlugins: [remarkGfm],
      rehypePlugins: [
        rehypeSlug,
        [rehypeAutolinkHeadings, { behavior: "wrap" }],
        [rehypeExternalLinks, { target: "_blank", rel: ["noopener", "noreferrer"] }],
      ],
    });
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  const source = await fetchPrivateGithubFileRaw({
    owner: "pdhoward",
    repo: "machinetemplate",
    path: "Instructions.mdx",
  });

  const lines = source.split("\n");

  let lo = 0;
  let hi = lines.length;
  let lastFail = { lo: 0, hi: lines.length };

  // Binary search: find smallest failing window
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    const head = lines.slice(0, mid).join("\n");
    // If head fails, shrink hi; else grow lo
    if (!(await mdxOk(head))) {
      hi = mid;
      lastFail = { lo: 0, hi: mid };
    } else {
      lo = mid;
    }
  }

  // Now zoom into a small neighborhood around hi to get a precise slice
  const start = Math.max(0, lastFail.hi - 40); // show 40 lines context
  const end = Math.min(lines.length, lastFail.hi + 5);
  const slice = lines.slice(start, end).join("\n");

  // Heuristics on the failing slice
  const risky = looksRiskyBlock(slice);

  return NextResponse.json({
    ok: false,
    approxFailRange: { startLine: start + 1, endLine: end }, // 1-based
    totalLines: lines.length,
    riskyHeuristics: risky,
    snippet: slice,
  }, { status: 500 });
}
