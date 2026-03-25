import { neon } from "@neondatabase/serverless";
import { drizzle as neonDrizzle } from "drizzle-orm/neon-http";
import postgres from "postgres";
import { drizzle as pgDrizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

const url = process.env.DATABASE_URL!;

export const db = url.includes("neon.tech")
  ? neonDrizzle(neon(url), { schema, casing: "snake_case" })
  : pgDrizzle(postgres(url), { schema, casing: "snake_case" });
