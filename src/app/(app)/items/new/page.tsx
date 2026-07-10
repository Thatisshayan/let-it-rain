"use client";

import { useActionState } from "react";
import { createItemAction, type ActionState } from "../actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const initialState: ActionState = {};

export default function NewItemPage() {
  const [state, formAction, pending] = useActionState(createItemAction, initialState);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">Add item</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Item details</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input id="category" name="category" placeholder="e.g. Packaging" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minStock">Minimum stock</Label>
                <Input id="minStock" name="minStock" type="number" min={0} defaultValue={0} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="initialQuantity">Starting quantity</Label>
              <Input
                id="initialQuantity"
                name="initialQuantity"
                type="number"
                min={0}
                defaultValue={0}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={3} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customFields">Custom fields (optional)</Label>
              <Textarea
                id="customFields"
                name="customFields"
                rows={3}
                placeholder={"One per line, e.g.\nSupplier: Acme Co\nUnit: box"}
              />
              <p className="text-xs text-muted-foreground">
                Format: <code>Key: Value</code>, one per line.
              </p>
            </div>
            {state.error && <p className="text-sm text-destructive">{state.error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save item"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
