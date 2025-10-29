## Strategic Machines

Basic app architecture for the Voice Agents platform

### Features Include
* Data driven AI architecture, where a set of tool descriptors retrieved from the db are used to direct the model for local or remote api calls
* Elegant interactions with the the LIVE Voice Agent, fully instructed through JSON Prompts on the scope, purpose and outcomes of a session
* Speciality tools for retrieving and querying website content, or celebrating a result, or finding and opening a web site
* Visual tool which provides the voice agent with capabilities to render forms, videos, images and documents based on the user request. These forms include a credit card payments for processing Stripe payments, and recording card data in a PCI DSS compliant manner (Payment Card Industry Data Security Standard) 

See the components/visuals/registry.tsx for the setup of a new component that can be rendered by the tool show_component 

* Tenant Custom tools providing the use case specific tools and functions required by the tenant for activating and enabling their Voice Agent. The Actions collection on Mongo (http descriptors) holds the http tool descriptors, which defines the api calls to the tenant's applications, such as a Booking Engine application (in the case of a tenant Hotel property), buying product (in case of a products company), scheduling appointments (in case of a professional services firm) or providing infomration about events. 

HTTP tool descriptors have declarative UI instructions.
Runtime behavior (from /api/tools/execute):
- Templating context is { args, response, status, secrets }.
- Strings in url/headers/body/ui are templated via `tpl()` (supports filters).
- Success = http.okField exists (truthy) in response OR HTTP 2xx when okField omitted.
- Then apply ui.onSuccess or ui.onError; payload is templated again with the same ctx.
- `pruneEmpty: true` strips "", null, {}, [] before sending.

✅ Authoring rules (critical):
1) Always reference caller params as {{args.your_field}} (not just {{your_field}}).
2) Coerce numbers/booleans in templates using filters, e.g. {{args.limit | number}}, {{args.include_rates | bool}}.
3) For currency, prefer {{args.currency | default('USD') | upper}}.
4) For nested JSON props, pass structured objects (not stringified), e.g. customer: "{{args.prefill | json}}".
5) Keep okField aligned with the API’s success shape (e.g., "ok" or "clientSecret").
6) If your API needs auth, use {{secrets.*}} in headers; the server will inject the secret.

#### Why this will “just work”

Numbers are numbers (| number) when they hit your APIs or UI props—no more "79000" surprises.

Objects are objects (| json)—no more "[object Object]".

Currency is normalized (| default('USD') | upper) everywhere.

Consistent {{args.*}} makes it obvious what’s coming from the model/tool call versus the API {{response.*}}.

The platform also can handle remote api calls to mongodb (retrieve Things collections via mongo gateway), and local nextjs api calls using the hooks/useTools set of tools - but this will be depracated in favor of api applications.

### Seeding Test Data
* Test data recorded and loaded from the agents/machines project
* Machine Seeds include the test data for HTTP descriptors (actions), Things (various objects), and Units (Villas available in the Cypress app. Note the Villas are retrieved through the booking_engine api, and are synced with the calendar and reservations collections for demo purposes.)

### Design Notes

Whats being demonstrated is that with a collection of https descriptors, and 2 gateways (one for mongo and the other for remote api calls), a complete data-driven AI Agent process can be constructed. 

The workflow involved ingesting the HTTP descriptors which are disaggregated and integrated with the Prompt as a set of tools. The descriptors provides required information for successfuly calling the api, as well as the expected range of reposonses. The Prompt provides the instructions on workflow, guardrails, and expected outcomes

The intent is to create a secure multitenant platform for companies to consume Voice and Text Agents providing an elegant and sophisticated range of interactions for products, reservations, sales, orders, appointments, and other common consumer activity, where the Web by itself is not sufficient by itself in engagement or resolution.

A 'human in the loop' capability will also be added

### A One Time Password (OTP) protection was added to track usage and limit rates

Note that google as a transporter requires a 16 character app password

Sign into gmail account and got to
https://myaccount.google.com/apppasswords

### RESEARCH
https://www.val.town/x/jubertioai/hello-realtime

425-800-0073

* example of agent orchestration
https://github.com/midday-ai/ai-sdk-tools/tree/main/apps/example

* using resend for email
https://github.com/resend/resend-nextjs-useactionstate-example
https://useworkflow.dev/

* essential utilities for using vercel ai sdk
https://github.com/midday-ai/ai-sdk-tools

* open source LLM registry for Vercel AI Gateway
https://github.com/FranciscoMoretti/ai-registry/
https://airegistry.app/

* CARTESIA
https://docs.cartesia.ai/get-started/overview

* ShadCN
https://ui.shadcn.com/docs/directory
https://billingsdk.com/