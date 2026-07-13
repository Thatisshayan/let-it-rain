"use client";

import { useActionState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateOrgSettingsAction, type ActionState } from "./actions";
import type { OrgSettings } from "./service";

const initialState: ActionState = {};

export function OrgSettingsTab({ settings }: { settings: OrgSettings }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    async (prev, formData) => {
      const result = await updateOrgSettingsAction(prev, formData);
      if (result.success) toast.success(result.success);
      return result;
    },
    initialState
  );

  return (
    <div className="space-y-6 max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organization</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={action} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="org-business-name">Business name</Label>
              <Input
                id="org-business-name"
                name="businessName"
                defaultValue={settings.businessName ?? ""}
                placeholder="Your business name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-low-stock">Default low-stock threshold</Label>
              <Input
                id="org-low-stock"
                name="defaultLowStock"
                type="number"
                min={0}
                defaultValue={settings.defaultLowStock}
              />
            </div>
            {state.error && <p className="text-sm text-destructive">{state.error}</p>}
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save settings"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
