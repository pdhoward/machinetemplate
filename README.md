## Strategic Machines

Basic app architecture for the Voice Agents platform

### Features Include
* Data driven AI architecture, where a set of tool descriptors retrieved from the db are used to direct the model for local or remote api calls
* Elegant interactions with the the LIVE Voice Agent, fully instructed through JSON Prompts on the scope, purpose and outcomes of a session
* Speciality tools for retrieving and querying website content, or celebrating a result, or finding and opening a web site
* Visual tool which provides the voice agent with capabilities to render forms, videos, images and documents based on the user request. These forms include a credit card payments for processing Stripe payments, and recording card data in a PCI DSS compliant manner (Payment Card Industry Data Security Standard) 

See the components/visuals/registry.tsx for the setup of a new component that can be rendered by the tool show_component 

* Tenant Custom tools providing the use case specific tools and functions required by the tenant for activating and enabling their Voice Agent. The Actions collection on Mongo (http descriptors) holds the http tool descriptors, which defines the api calls to the tenant's applications, such as a Booking Engine application (in the case of a tenant Hotel property), buying product (in case of a products company), scheduling appointments (in case of a professional services firm) or providing infomration about events. 

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