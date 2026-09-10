"use client";

import { useTransition } from "react";
import { setUserRole } from "./actions";

export function RoleSelector({
  userId,
  clientId,
  currentRole,
}: {
  userId: string;
  clientId: string;
  currentRole: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      defaultValue={currentRole}
      disabled={isPending}
      onChange={(e) => {
        const newRole = e.target.value;
        startTransition(async () => {
          await setUserRole(userId, clientId, newRole);
        });
      }}
      className="h-7 rounded border border-input bg-white px-2 text-xs font-semibold text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
    >
      <option value="viewer">viewer</option>
      <option value="admin">admin</option>
    </select>
  );
}
