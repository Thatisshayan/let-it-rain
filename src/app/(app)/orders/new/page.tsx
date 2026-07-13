import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NewOrderForm } from "./new-order-form";

export default async function NewOrderPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasPermission(session, "CREATE_ORDERS")) redirect("/orders");

  const items = await prisma.item.findMany({
    where: { deletedAt: null, organizationId: session.organizationId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, quantity: true },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">New order</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Order details</CardTitle>
        </CardHeader>
        <CardContent>
          <NewOrderForm items={items} />
        </CardContent>
      </Card>
    </div>
  );
}
