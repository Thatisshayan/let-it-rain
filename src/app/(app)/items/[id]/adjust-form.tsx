"use client";

import { useActionState, useState } from "react";
import { adjustStockAction, type ActionState } from "../actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const initialState: ActionState = {};

type Mode = "RECEIVE" | "REMOVE" | "ADJUST";

const MODE_LABEL: Record<Mode, string> = {
  RECEIVE: "Receive stock",
  REMOVE: "Remove stock",
  ADJUST: "Count / adjust",
};

export function AdjustStockForm({ itemId, currentQuantity }: { itemId: string; currentQuantity: number }) {
  const [mode, setMode] = useState<Mode>("RECEIVE");
  const boundAction = adjustStockAction.bind(null, itemId);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (prev, formData) => {
      const result = await boundAction(prev, formData);
      if (!result.error) {
        toast.success(`${MODE_LABEL[mode]} recorded`);
      }
      return result;
    },
    initialState
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {(Object.keys(MODE_LABEL) as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
              mode === m
                ? "bg-gradient-to-br from-primary to-rain text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {MODE_LABEL[m]}
          </button>
        ))}
      </div>

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="type" value={mode} />

        {mode !== "ADJUST" ? (
          <div className="space-y-2">
            <Label htmlFor="amount">Quantity</Label>
            <Input id="amount" name="amount" type="number" min={1} required />
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="counted">Counted quantity (current: {currentQuantity})</Label>
            <Input id="counted" name="counted" type="number" min={0} required />
          </div>
        )}

        {mode === "RECEIVE" && (
          <div className="space-y-2">
            <Label htmlFor="unitCost">Unit cost (leave blank to keep current)</Label>
            <Input id="unitCost" name="unitCost" type="number" min={0} step="0.01" />
          </div>
        )}

        {mode === "REMOVE" && (
          <div className="flex items-center gap-2">
            <Checkbox id="isSale" name="isSale" value="true" defaultChecked />
            <Label htmlFor="isSale" className="font-normal">
              This is a sale (counts toward revenue)
            </Label>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="reason">Reason / note {mode === "ADJUST" ? "(required if count differs)" : "(optional)"}</Label>
          <Textarea id="reason" name="reason" rows={2} />
        </div>

        {state.error && <p className="text-sm text-destructive">{state.error}</p>}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Saving…" : MODE_LABEL[mode]}
        </Button>
      </form>
    </div>
  );
}
