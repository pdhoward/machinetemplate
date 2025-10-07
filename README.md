## Strategic Machines

Basic app architecture for the Voice Agents platform

### Features Include
* Data driven AI architecture, where a set of tool descriptors retrieved from the db are used to direct the model for local or remote api calls
* Elegant interactions with the the LIVE Voice Agent, fully instructed through JSON Prompts on the scope, purpose and outcomes of a session
* Speciality tools for retrieving and querying website content, or celebrating a result
* Through the Actions collection (http descriptors) demonstrate remote api calls to a Booking Engine application, remote api calls to mongodb (retrieve Things collections via mongo gateway), and local nextjs api calls using the hooks/useTools set of tools


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