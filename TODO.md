## Actions and Refactors

- generate prompt tools instructions directly from http descriptors
- the visual components are explicitly referenced too many times, like in instructions.mdx,
visual stage, use visuals, tools.ts, registry.tsx ....simplify this structure -- one source of truth

- The platform provides predefined and prepackaged components (VOX VISUALS) as well as apis for STRIPE
- THis is problematic my opinion on payments front with Voice Agents in configuring the platform for different customer

- ask groq to generate user docs?
-- note that http tool descriptors connect 3rd party apis to instructions for the AI engine (when to call, how to call, how to handle a response)
-- especially for Reservation component - pretty complex with Stripe (and predefined api routes)

- will need an AI editor to create http tools for user

- app/docs - use AI to structure and write a set of user docs -- need editor mode for http tool descriptors
- need to work on the docs - maybe use shadcn for display?
- also need docs on exactly how this works - rate vs sessions ... whats being recorded on mongo vs upstash

- test app/validate

- explore addition of welcome (disclaimer for beta)- and maybe tools education (see garbage/machinetemplate/components)

- upgrade to nextjs 16 use codemod to assist in upgrade
https://nextjs.org/docs/app/guides/upgrading/version-16

- for Transcript component - created_at is being set to updated_at ,,, debug we need to keep the original create date



When you need to invoice, join in application code by emailHash.
// On session creation:
await db.collection("users").updateOne(
  { emailHash },
  { $setOnInsert: { emailHash, createdAt: new Date() }, $set: { email, tenantId, updatedAt: new Date() } },
  { upsert: true }
);

- figure out what to do with janitor.ts from xscripts .... suggested
{ "scripts": { "cron:janitor": "ts-node scripts/janitor.ts" } }
Set up a cron (GitHub Actions, Render cron, Vercel Cron, etc.) to call npm run cron:janitor every minute or two.

- Test Heartbeat --- also what calls the heartbeat every 60 sec?

- test >>>you should see usage_daily.dollars/tokens incrementing as you talk to the agent, and realtime_sessions.lastSeenAt marching forward every ~45s.
---------------

MultiTenant Actions

1. add flex option to select Tenant for the app (demo version of app)
2. Tenant ID & options is retrieved from website/tenant
3. Update Tenants for Cypress and ProductCo (reseed db)
4. Update Agents for ProductCo Agent (reseed db)
5. Build HTTP Descriptor (actions) for ProductCo >> direct mongo query/search
6. Build HTTP Descriptor for stats - how many options for example, or lowest price etc
7. Complete order form for product?
7.1 - Prompt Lib update
7.2 - Visuals?

8. Update Agents for EventAgent -- upcoming conference
9. Build HTTP Descriptor - info, speakers, etc lots of content -- need an
api end point with this content

10. Build a sales agents for my sales agents

---------------
Documentation
https://fumadocs.dev/

