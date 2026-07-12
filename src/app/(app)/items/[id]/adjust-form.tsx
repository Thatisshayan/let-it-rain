"use client";

import { useActionState, useMemo, useState } from "react";
import { adjustStockAction, type ActionState } from "../actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  const [cashAmount, setCashAmount] = useState("");
  const [interacAmount, setInteracAmount] = useState("");
  const total = useMemo(
    () => (Number(cashAmount) || 0) + (Number(interacAmount) || 0),
    [cashAmount, interacAmount]
  );
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
          <div className="space-y-3 rounded-lg border border-border/60 p-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="cashAmount">Cash received</Label>
                <Input
                  id="cashAmount"
                  name="cashAmount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="interacAmount">Interac received</Label>
                <Input
                  id="interacAmount"
                  name="interacAmount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={interacAmount}
                  onChange={(e) => setInteracAmount(e.target.value)}
                />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Total: <span className="font-medium text-foreground">${total.toFixed(2)}</span>
              {total === 0 && " — leave both blank for a non-sale removal (e.g. damaged stock)."}
            </p>
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
