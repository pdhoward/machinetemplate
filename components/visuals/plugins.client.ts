// components/visuals/plugins.client.ts
"use client";

import { registerVisualComponent } from "@/components/visuals/registry";

// partner-provided mapping → lazy chunk
registerVisualComponent("map_view", () => import("@partner/widgets/MapView"));
// register more…

/*


// components/ClientInit.tsx
"use client";
import "@/components/visuals/plugins.client"; // side-effect import
export default function ClientInit() { return null; }

-----------------------
// app/layout.tsx (inside <body>)
<ClientInit />


*/
