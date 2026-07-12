import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { EditItemForm } from "./edit-form";

export default async function EditItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  const canViewCosts = hasPermission(session, "VIEW_COSTS");

  const { id } = await params;
  const [item, distinctCategories] = await Promise.all([
    prisma.item.findUnique({ where: { id, deletedAt: null } }),
    prisma.item.findMany({
      where: { deletedAt: null, category: { not: null } },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    }),
  ]);
  if (!item) notFound();

  const categories = distinctCategories
    .map((c) => c.category)
    .filter((c): c is string => Boolean(c));

  const customFields = (item.customFields as Record<string, string> | null) ?? {};
  const customFieldsText = Object.entries(customFields)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">Edit item</h1>
      <EditItemForm item={item} customFieldsText={customFieldsText} categories={categories} canViewCosts={canViewCosts} />
    </div>
  );
}
