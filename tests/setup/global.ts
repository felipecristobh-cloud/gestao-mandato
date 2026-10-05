import { execSync } from "node:child_process";
import "dotenv/config";

export default function setup() {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error("Defina DATABASE_URL_TEST (veja .env.example).");
  if (!/test/.test(url)) throw new Error("DATABASE_URL_TEST deve apontar para um banco de teste (nome contendo 'test').");
  execSync("npx prisma migrate reset --force --skip-seed --skip-generate", {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "inherit",
  });
  process.env.DATABASE_URL = url;
}
