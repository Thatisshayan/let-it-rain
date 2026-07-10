import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { EditItemForm } from "./edit-form";

export default async function EditItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) notFound();

  const customFields = (item.customFields as Record<string, string> | null) ?? {};
  const customFieldsText = Object.entries(customFields)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">Edit item</h1>
      <EditItemForm item={item} customFieldsText={customFieldsText} />
    </div>
  );
}
