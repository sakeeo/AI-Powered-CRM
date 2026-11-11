"use client";

import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { orgPluginAc, orgPluginRoles } from "@/lib/roles";

export const authClient = createAuthClient({
  plugins: [organizationClient({ ac: orgPluginAc, roles: orgPluginRoles })],
});
