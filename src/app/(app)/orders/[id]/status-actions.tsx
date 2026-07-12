"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markOutForDeliveryAction, cancelOrderAction } from "../actions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function StatusActions({ orderId, canCancel }: { orderId: string; canCancel: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onOutForDelivery() {
    startTransition(async () => {
      const result = await markOutForDeliveryAction(orderId);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Marked out for delivery");
        router.refresh();
      }
    });
  }

  function onCancel() {
    startTransition(async () => {
      const result = await cancelOrderAction(orderId);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Order cancelled");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex gap-2">
      <Button onClick={onOutForDelivery} disabled={pending}>
        Mark out for delivery
      </Button>
      {canCancel && (
        <Button variant="outline" onClick={onCancel} disabled={pending}>
          Cancel order
        </Button>
      )}
    </div>
  );
}
