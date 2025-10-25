## Actions and Refactors


- update the route to fetch the client config from mongo vs using .env
- confirm the payments collection being used and PCI DSS conformance
- delete components no longer in use like PaymentForm and others
- generate prompt tools instructions directly from http descriptors
- the visual components are explcitly referenced too many times, like in instructions.mdx,
visual stage, use visuals, tools.ts, registry.tsx ....simplify this structure -- one source of truth

- for lib/agent/registerTenantHttpTools ... need to handle the case of emit.say()
-- definitely look to context 

- ask groq to generate user docs?
-- note that http tool descriptors connect 3rd party apis to instructions for the AI engine (when to call, how to call, how to handle a response)

- will need a an AI editor to create http tools for user

- blog with an inviation - TRY IT
