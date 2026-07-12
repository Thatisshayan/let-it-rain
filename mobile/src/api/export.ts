import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { apiFetchText } from "./client";

async function shareCsv(csvText: string, filename: string): Promise<void> {
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  file.write(csvText);

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error("Sharing isn't available on this device.");
  }
  await Sharing.shareAsync(file.uri, { mimeType: "text/csv", UTI: "public.comma-separated-values-text" });
}

export async function exportItemsCsv(): Promise<void> {
  const csv = await apiFetchText("/api/v1/items/export.csv");
  await shareCsv(csv, "letitrain-items.csv");
}

export async function exportItemMovementsCsv(itemId: string, itemName: string): Promise<void> {
  const csv = await apiFetchText(`/api/v1/items/${itemId}/movements/export.csv`);
  const safeName = itemName.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  await shareCsv(csv, `letitrain-${safeName}-movements.csv`);
}
