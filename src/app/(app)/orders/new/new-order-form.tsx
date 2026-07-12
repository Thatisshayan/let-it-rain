"use client";

import { useActionState, useState } from "react";
import { createOrderAction, type ActionState } from "../actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const initialState: ActionState = {};

type Item = { id: string; name: string; quantity: number };
type Row = { id: number; itemId: string; quantity: string };

let rowKey = 0;

export function NewOrderForm({ items }: { items: Item[] }) {
  const [state, formAction, pending] = useActionState(createOrderAction, initialState);
  const [rows, setRows] = useState<Row[]>([{ id: rowKey++, itemId: "", quantity: "1" }]);

  function addRow() {
    setRows((prev) => [...prev, { id: rowKey++, itemId: "", quantity: "1" }]);
  }

  function removeRow(id: number) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="customerName">Customer name *</Label>
        <Input id="customerName" name="customerName" required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="customerAddress">Delivery address</Label>
          <Input id="customerAddress" name="customerAddress" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="customerPhone">Phone</Label>
          <Input id="customerPhone" name="customerPhone" />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Items *</Label>
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.id} className="flex items-center gap-2">
              <select
                name="lineItemId[]"
                required
                defaultValue={row.itemId}
                className="h-9 flex-1 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="" disabled>
                  Select an item…
                </option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.quantity} in stock)
                  </option>
                ))}
              </select>
              <Input
                name="lineItemQuantity[]"
                type="number"
                min={1}
                defaultValue={row.quantity}
                required
                className="w-24"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => removeRow(row.id)}
                disabled={rows.length === 1}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          + Add item
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={2} />
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create order"}
        </Button>
      </div>
    </form>
  );
}
