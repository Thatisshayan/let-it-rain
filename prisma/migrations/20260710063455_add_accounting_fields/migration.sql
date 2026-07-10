-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "unitCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "unitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Movement" ADD COLUMN     "isSale" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "unitCostAtTime" DECIMAL(12,2),
ADD COLUMN     "unitPriceAtTime" DECIMAL(12,2);

-- CreateIndex
CREATE INDEX "Movement_isSale_createdAt_idx" ON "Movement"("isSale", "createdAt");
