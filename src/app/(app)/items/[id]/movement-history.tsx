"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { loadMoreMovementsAction, type MovementRow } from "./actions";

const MOVEMENT_LABEL: Record<string, string> = {
  RECEIVE: "Received",
  REMOVE: "Removed",
  ADJUST: "Count adjusted",
};

const MOVEMENT_DOT: Record<string, string> = {
  RECEIVE: "bg-success",
  REMOVE: "bg-warning",
  ADJUST: "bg-rain",
};

function MovementRowItem({ m }: { m: MovementRow }) {
  return (
    <li className="flex items-center justify-between gap-4 py-3 text-sm">
      <div>
        <p className="flex items-center gap-2 font-medium">
          <span
            className={cn("size-1.5 shrink-0 rounded-full", MOVEMENT_DOT[m.type] ?? "bg-muted-foreground")}
          />
          {MOVEMENT_LABEL[m.type] ?? m.type}{" "}
          <span className="tabular-nums text-muted-foreground">
            ({m.delta > 0 ? "+" : ""}
            {m.delta})
          </span>
        </p>
        <p className="text-xs text-muted-foreground">
          {m.user.name} · {new Date(m.createdAt).toLocaleString("en-US")}
        </p>
        {m.reason && <p className="mt-1 text-xs">{m.reason}</p>}
      </div>
      <span className="tabular-nums text-muted-foreground">→ {m.quantityAfter}</span>
    </li>
  );
}

export function MovementHistory({
  itemId,
  initialMovements,
  initialCursor,
}: {
  itemId: string;
  initialMovements: MovementRow[];
  initialCursor: { createdAt: string; id: string } | null;
}) {
  const [movements, setMovements] = useState(initialMovements);
  const [cursor, setCursor] = useState(initialCursor);
  const [pending, startTransition] = useTransition();

  if (movements.length === 0) {
    return <p className="text-sm text-muted-foreground">No movements recorded yet.</p>;
  }

  return (
    <div>
      <ul className="divide-y">
        {movements.map((m) => (
          <MovementRowItem key={m.id} m={m} />
        ))}
      </ul>
      {cursor && (
        <Button
          variant="outline"
          size="sm"
          className="mt-3 w-full"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const result = await loadMoreMovementsAction(itemId, cursor);
              setMovements((prev) => [...prev, ...result.movements]);
              setCursor(result.nextCursor);
            });
          }}
        >
          {pending ? "Loading…" : "Load more"}
        </Button>
      )}
    </div>
  );
}
