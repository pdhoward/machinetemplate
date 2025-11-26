// instrumentation-client.ts
import { initBotId } from "botid/client/core";

initBotId({
  protect: [
    {
      path: '/api/session',
      method: 'POST',
    },
    {
      path: "/api/booking/*/payments/create-intent",
      method: "POST",
    },
  ],
});
