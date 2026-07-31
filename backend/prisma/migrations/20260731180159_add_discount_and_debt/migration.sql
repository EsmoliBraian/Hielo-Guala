-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('FIXED', 'PERCENTAGE');

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'DEBT';

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "debtSettledAt" TIMESTAMP(3),
ADD COLUMN     "discountType" "DiscountType",
ADD COLUMN     "discountValue" DECIMAL(10,2),
ADD COLUMN     "subtotalAmount" DECIMAL(10,2);
