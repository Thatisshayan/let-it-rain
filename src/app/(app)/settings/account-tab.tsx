"use client";

import { useActionState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateOwnProfileAction, changeOwnPasswordAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export function AccountTab({ name }: { name: string }) {
  const [profileState, profileAction, profilePending] = useActionState<ActionState, FormData>(
    async (prev, formData) => {
      const result = await updateOwnProfileAction(prev, formData);
      if (result.success) toast.success(result.success);
      return result;
    },
    initialState
  );
  const [pwState, pwAction, pwPending] = useActionState<ActionState, FormData>(
    async (prev, formData) => {
      const result = await changeOwnPasswordAction(prev, formData);
      if (result.success) toast.success(result.success);
      return result;
    },
    initialState
  );

  return (
    <div className="space-y-6 max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={profileAction} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="account-name">Name</Label>
              <Input id="account-name" name="name" defaultValue={name} required />
            </div>
            {profileState.error && <p className="text-sm text-destructive">{profileState.error}</p>}
            <Button type="submit" disabled={profilePending}>
              {profilePending ? "Saving…" : "Save name"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Change password</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={pwAction} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current password</Label>
              <Input id="current-password" name="currentPassword" type="password" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input id="new-password" name="newPassword" type="password" minLength={8} required />
            </div>
            {pwState.error && <p className="text-sm text-destructive">{pwState.error}</p>}
            <Button type="submit" disabled={pwPending}>
              {pwPending ? "Saving…" : "Change password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
