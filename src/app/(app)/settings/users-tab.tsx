"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PERMISSIONS, PERMISSION_LABEL, type Permission } from "@/lib/permissions";
import {
  createUserAction,
  updateUserPermissionsAction,
  setUserActiveAction,
  resetUserPasswordAction,
  type ActionState,
} from "./actions";

type UserRow = {
  id: string;
  name: string;
  email: string;
  permissions: string[];
  active: boolean;
};

const initialState: ActionState = {};

function PermissionCheckboxes({ defaultPermissions }: { defaultPermissions: Permission[] }) {
  return (
    <div className="space-y-2">
      <Label>Permissions</Label>
      <div className="grid grid-cols-2 gap-2">
        {PERMISSIONS.map((perm) => (
          <label key={perm} className="flex items-center gap-2 text-sm">
            <Checkbox name="permissions" value={perm} defaultChecked={defaultPermissions.includes(perm)} />
            {PERMISSION_LABEL[perm]}
          </label>
        ))}
      </div>
    </div>
  );
}

function CreateUserDialog() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (prev, formData) => {
      const result = await createUserAction(prev, formData);
      if (result.success) {
        toast.success(result.success);
        setOpen(false);
        router.refresh();
      }
      return result;
    },
    initialState
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>+ Create user</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create user</DialogTitle>
          <DialogDescription>
            Set their password directly and share it with them — there&apos;s no email delivery.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="new-name">Name</Label>
            <Input id="new-name" name="name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-email">Email</Label>
            <Input id="new-email" name="email" type="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">Password</Label>
            <Input id="new-password" name="password" type="text" minLength={8} required />
          </div>
          <PermissionCheckboxes defaultPermissions={[...PERMISSIONS]} />
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({ user }: { user: UserRow }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [permState, permAction, permPending] = useActionState<ActionState, FormData>(
    async (prev, formData) => {
      const result = await updateUserPermissionsAction(user.id, prev, formData);
      if (result.success) {
        toast.success(result.success);
        router.refresh();
      }
      return result;
    },
    initialState
  );
  const [pwState, pwAction, pwPending] = useActionState<ActionState, FormData>(
    async (prev, formData) => {
      const result = await resetUserPasswordAction(user.id, prev, formData);
      if (result.success) toast.success(result.success);
      return result;
    },
    initialState
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Edit</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{user.name}</DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>

        <form action={permAction} className="space-y-3">
          <PermissionCheckboxes defaultPermissions={user.permissions as Permission[]} />
          {permState.error && <p className="text-sm text-destructive">{permState.error}</p>}
          <Button type="submit" size="sm" disabled={permPending}>
            {permPending ? "Saving…" : "Save permissions"}
          </Button>
        </form>

        <form action={pwAction} className="space-y-2 border-t pt-3">
          <Label htmlFor={`reset-pw-${user.id}`}>Reset password</Label>
          <div className="flex gap-2">
            <Input id={`reset-pw-${user.id}`} name="password" type="text" minLength={8} placeholder="New password" />
            <Button type="submit" variant="outline" size="sm" disabled={pwPending}>
              {pwPending ? "Saving…" : "Reset"}
            </Button>
          </div>
          {pwState.error && <p className="text-sm text-destructive">{pwState.error}</p>}
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeactivateButton({ user }: { user: UserRow }) {
  const [pending, setPending] = useState(false);
  const router = useRouter();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        const result = await setUserActiveAction(user.id, !user.active);
        if (result.error) toast.error(result.error);
        else router.refresh();
        setPending(false);
      }}
    >
      {user.active ? "Deactivate" : "Reactivate"}
    </Button>
  );
}

export function UsersTab({ users, currentUserId }: { users: UserRow[]; currentUserId: string }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">Users</CardTitle>
        <CreateUserDialog />
      </CardHeader>
      <CardContent className="space-y-2">
        {users.map((user) => (
          <div
            key={user.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm"
          >
            <div>
              <p className="font-medium">
                <Link
                  href={`/settings/users/${user.id}`}
                  className="hover:underline focus:underline focus:outline-none"
                >
                  {user.name}
                </Link>{" "}
                {user.id === currentUserId && <span className="text-xs text-muted-foreground">(you)</span>}
              </p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {user.permissions.length === 0 ? (
                  <Badge variant="outline">No permissions</Badge>
                ) : (
                  user.permissions.map((p) => (
                    <Badge key={p} variant="secondary">
                      {p}
                    </Badge>
                  ))
                )}
                {!user.active && <Badge variant="destructive">Inactive</Badge>}
              </div>
            </div>
            <div className="flex gap-2">
              <EditUserDialog user={user} />
              {user.id !== currentUserId && <DeactivateButton user={user} />}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
