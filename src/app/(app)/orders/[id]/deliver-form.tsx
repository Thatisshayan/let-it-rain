"use client";

import { useActionState } from "react";
import { markDeliveredAction, type ActionState } from "../actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const initialState: ActionState = {};

export function DeliverForm({
  orderId,
  lineItems,
}: {
  orderId: string;
  lineItems: { id: string; itemName: string }[];
}) {
  const boundAction = markDeliveredAction.bind(null, orderId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  return (
    <form action={formAction} className="space-y-3 border-t border-border/60 pt-4">
      <p className="text-sm font-medium">Mark delivered</p>
      <p className="text-xs text-muted-foreground">
        Enter what the customer paid per item, if anything — leave blank for a non-sale delivery.
      </p>
      {lineItems.map((li) => (
        <div key={li.id} className="grid grid-cols-3 items-end gap-2">
          <input type="hidden" name="lineItemId[]" value={li.id} />
          <p className="col-span-3 text-sm font-medium sm:col-span-1 sm:self-center">{li.itemName}</p>
          <div className="space-y-1">
            <Label className="text-xs">Cash</Label>
            <Input name="cashAmount[]" type="number" min={0} step="0.01" defaultValue={0} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Interac</Label>
            <Input name="interacAmount[]" type="number" min={0} step="0.01" defaultValue={0} />
          </div>
        </div>
      ))}
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Confirm delivered"}
      </Button>
    </form>
  );
}
