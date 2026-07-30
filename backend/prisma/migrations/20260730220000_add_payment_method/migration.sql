-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TRANSFER');

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "paymentMethod" "PaymentMethod";

