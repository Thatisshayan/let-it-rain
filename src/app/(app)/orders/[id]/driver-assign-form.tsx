"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignDriverAction } from "../actions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function DriverAssignForm({
  orderId,
  drivers,
  currentDriverId,
}: {
  orderId: string;
  drivers: { id: string; name: string }[];
  currentDriverId: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await assignDriverAction(orderId, formData);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Driver assigned");
        router.refresh();
      }
    });
  }

  return (
    <form action={onSubmit} className="flex items-center gap-2">
      <select
        name="driverId"
        defaultValue={currentDriverId ?? ""}
        className="h-9 flex-1 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <option value="">Unassigned</option>
        {drivers.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Assign"}
      </Button>
    </form>
  );
}
