## Actions and Refactors
- ADD billing machine to machineweb - see shadcn
- update the route to fetch the client config from mongo vs using .env
- confirm the payments collection being used and PCI DSS conformance

- generate prompt tools instructions directly from http descriptors
- the visual components are explcitly referenced too many times, like in instructions.mdx,
visual stage, use visuals, tools.ts, registry.tsx ....simplify this structure -- one source of truth

- for lib/agent/registerTenantHttpTools ... need to handle the case of emit.say()
-- definitely look to context 

- ask groq to generate user docs?
-- note that http tool descriptors connect 3rd party apis to instructions for the AI engine (when to call, how to call, how to handle a response)

- will need a an AI editor to create http tools for user

- blog with an inviation - TRY IT

- explore _lib and getActiveOtpSession used by transcripts api

- app/docs - use AI to structure and write a set of user docs -- need editor mode for http tool descriptors

- app/validate - needs docs - http descriptor linter and validation - critical for tool builds

- explore addition of welcome (disclaimer for beta)- and maybe tools education (see garbage/machinetemplate/components)

- upgrade to nextjs 16 use codemod to assist in upgrade
https://nextjs.org/docs/app/guides/upgrading/version-16
