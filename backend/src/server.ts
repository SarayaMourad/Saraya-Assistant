import "dotenv/config";
import { app } from "./app";
import { prisma } from "./lib/prisma";

const port = Number(process.env.PORT || 4000);

app.listen(port, () => {
  console.log(`Saraya Assistant API listening on :${port}`);
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
