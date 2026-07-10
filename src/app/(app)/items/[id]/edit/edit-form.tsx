"use client";

import { useActionState } from "react";
import { updateItemAction, type ActionState } from "../../actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Item } from "@/generated/prisma/client";

const initialState: ActionState = {};

export function EditItemForm({
  item,
  customFieldsText,
}: {
  item: Item;
  customFieldsText: string;
}) {
  const boundAction = updateItemAction.bind(null, item.id);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Item details</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" name="name" required defaultValue={item.name} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input id="category" name="category" defaultValue={item.category ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minStock">Minimum stock</Label>
              <Input
                id="minStock"
                name="minStock"
                type="number"
                min={0}
                defaultValue={item.minStock}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              rows={3}
              defaultValue={item.description ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customFields">Custom fields</Label>
            <Textarea
              id="customFields"
              name="customFields"
              rows={3}
              defaultValue={customFieldsText}
              placeholder={"One per line, e.g.\nSupplier: Acme Co\nUnit: box"}
            />
            <p className="text-xs text-muted-foreground">
              Format: <code>Key: Value</code>, one per line.
            </p>
          </div>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
