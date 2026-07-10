import { prisma } from "@/lib/prisma";
import { NewItemForm } from "./new-item-form";

export default async function NewItemPage() {
  const distinctCategories = await prisma.item.findMany({
    where: { deletedAt: null, category: { not: null } },
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
      <NewItemForm categories={categories} />
    </div>
  );
}
