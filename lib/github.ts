// lib/github.ts
export async function fetchPrivateGithubFileRaw(opts: {
  owner: string;
  repo: string;
  path: string; // e.g. "Instructions.mdx"
  ref?: string;
}) {
  
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN missing");

  const url = new URL(
    `https://api.github.com/repos/${opts.owner}/${opts.repo}/contents/${opts.path}`
  );
  if (opts.ref) url.searchParams.set("ref", opts.ref);

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3.raw",
      "User-Agent": "booking-engine-docs",
    },
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`GitHub fetch failed: ${res.status}`);
  return res.text();
}
