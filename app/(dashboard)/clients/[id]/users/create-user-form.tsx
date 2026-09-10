"use client";

import { useActionState } from "react";
import { createClientUser } from "./actions";

const INPUT_CLASS =
  "h-8 rounded-md border border-input bg-white px-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30";
const SELECT_CLASS =
  "h-8 rounded-md border border-input bg-white px-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";
const LABEL_CLASS = "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

export function CreateUserForm({ clientId }: { clientId: string }) {
  const [error, formAction, isPending] = useActionState(createClientUser, null);

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-end gap-2 mb-6 p-3 rounded-lg border border-border bg-card"
    >
      <input type="hidden" name="clientId" value={clientId} />

      <div className="flex flex-col gap-1">
        <label className={LABEL_CLASS}>Email</label>
        <input
          name="email"
          type="email"
          required
          placeholder="ops@client.com"
          className={`${INPUT_CLASS} w-56`}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className={LABEL_CLASS}>Name</label>
        <input name="name" placeholder="Optional" className={`${INPUT_CLASS} w-40`} />
      </div>
      <div className="flex flex-col gap-1">
        <label className={LABEL_CLASS}>Role</label>
        <select name="role" defaultValue="viewer" className={SELECT_CLASS}>
          <option value="viewer">viewer</option>
          <option value="admin">admin</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className={LABEL_CLASS}>Initial Password</label>
        <input
          name="password"
          type="text"
          required
          minLength={8}
          placeholder="At least 8 characters"
          className={`${INPUT_CLASS} w-44 font-mono`}
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="h-8 px-3.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
      >
        {isPending ? "Creating..." : "Create User"}
      </button>
      {error && <p className="text-xs text-rose-600 w-full">{error}</p>}
    </form>
  );
}
