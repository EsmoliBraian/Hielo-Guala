import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PRODUCTS: {
  name: string;
  weightKg: number;
  price: number;
  aliases: string[];
}[] = [
  {
    name: "Bolsa 2kg",
    weightKg: 2,
    price: 0,
    aliases: ["bolsita", "bolsitas", "hielo chico"],
  },
  {
    name: "Bolsa 3kg",
    weightKg: 3,
    price: 0,
    aliases: ["bolsa de melin", "melin", "bolsa"],
  },
  {
    name: "Bolsa 10kg",
    weightKg: 10,
    price: 0,
    aliases: ["bolson", "bolsón", "hielo grande"],
  },
];

async function main() {
  for (const { aliases, ...productData } of PRODUCTS) {
    const product = await prisma.product.upsert({
      where: { name: productData.name },
      update: productData,
      create: productData,
    });

    for (const alias of aliases) {
      await prisma.productAlias.upsert({
        where: { alias },
        update: { productId: product.id },
        create: { alias, productId: product.id },
      });
    }
  }

  console.log("Seed completo: 3 productos y alias iniciales cargados.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
