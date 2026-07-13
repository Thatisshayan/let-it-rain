import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { NewItemForm } from "./new-item-form";

export default async function NewItemPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasPermission(session, "EDIT_ITEMS")) redirect("/items");
  const canViewCosts = hasPermission(session, "VIEW_COSTS");

  const distinctCategories = await prisma.item.findMany({
    where: { deletedAt: null, category: { not: null }, organizationId: session.organizationId },
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  });
  const categories = distinctCategories
    .map((c) => c.category)
    .filter((c): c is string => Boolean(c));

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">Add item</h1>
      <NewItemForm categories={categories} canViewCosts={canViewCosts} />
    </div>
  );
}
