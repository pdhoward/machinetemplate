## Actions and Refactors
- ADD billing machine to machineweb - see shadcn
- update the route to fetch the client config from mongo vs using .env
- confirm the payments collection being used and PCI DSS conformance

- generate prompt tools instructions directly from http descriptors
- the visual components are explcitly referenced too many times, like in instructions.mdx,
visual stage, use visuals, tools.ts, registry.tsx ....simplify this structure -- one source of truth

- ask groq to generate user docs?
-- note that http tool descriptors connect 3rd party apis to instructions for the AI engine (when to call, how to call, how to handle a response)
-- especially for Reservation cmponent - pretty complex with Stripe

- will need a an AI editor to create http tools for user

- explore _lib and getActiveOtpSession used by transcripts api

- app/docs - use AI to structure and write a set of user docs -- need editor mode for http tool descriptors

- app/validate - needs docs - http descriptor linter and validation - critical for tool builds

- explore addition of welcome (disclaimer for beta)- and maybe tools education (see garbage/machinetemplate/components)

- upgrade to nextjs 16 use codemod to assist in upgrade
https://nextjs.org/docs/app/guides/upgrading/version-16

- for Transcript component - created_at is being set to updated_at ,,, debug we need to keep the original create date

- when errors thrown for rates and 'too many sessions' ... need a user friendly message on web page

- also - put admin function in so i do no get rate limited?

- see tool validate function - failing on custom tools

- for various throw errors - the error page not rendering

- need to work on the docs - maybe use shadcn for display?

- for production version - recheck the stripe payment process and also it appears that i asked for 2 nights ... but the reservation was recorded for 3 nights???

- for prod vs dev - disable rate limits and session limits in dev

- also need docs on exactly how this works - rate vs sessions ... whats being recorded on mongo vs upstash

- also update the booking-engine app so that confirmed reservations are marked on the calendar

- need a map between PII hash and emails using this code
-- Keep PII separate (recommended):

Create a users collection that maps emailHash → { email, tenantId, ... }.

Upsert on login/session creation so the map stays fresh.

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

- also what calls the heartbeat every 60 sec?

