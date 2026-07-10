"use client";

import { useState } from "react";
import { deleteItemAction } from "../actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function DeleteItemButton({ itemId, itemName }: { itemId: string; itemName: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="destructive" size="sm" />}>
        Delete item
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete “{itemName}”?</DialogTitle>
          <DialogDescription>
            This permanently deletes the item and its full movement history. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <form action={deleteItemAction.bind(null, itemId)}>
            <Button variant="destructive" type="submit">
              Delete permanently
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
