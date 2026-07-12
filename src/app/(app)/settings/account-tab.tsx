"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateOwnProfileAction, changeOwnPasswordAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export function AccountTab({ name }: { name: string }) {
  const router = useRouter();
  const [signingOutEverywhere, setSigningOutEverywhere] = useState(false);
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

  async function handleSignOutEverywhere() {
    if (signingOutEverywhere) return;
    const confirmed = window.confirm(
      "Sign out of every device? You'll need to sign in again to continue using the app."
    );
    if (!confirmed) return;

    setSigningOutEverywhere(true);
    try {
      const res = await fetch("/api/v1/me/sessions", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(body.error ?? "Could not sign out everywhere.");
        setSigningOutEverywhere(false);
        return;
      }
      // Hit /api/v1/auth/logout to clear the cookie, then redirect.
      await fetch("/api/v1/auth/logout", { method: "POST" });
      toast.success("Signed out everywhere. Please sign in again.");
      router.push("/login");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sign out everywhere.");
      setSigningOutEverywhere(false);
    }
  }

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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sessions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Force all browsers and devices to sign out of your account. You&apos;ll need to
            sign in again here.
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={signingOutEverywhere}
            onClick={handleSignOutEverywhere}
          >
            {signingOutEverywhere ? "Signing out…" : "Sign out everywhere"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
