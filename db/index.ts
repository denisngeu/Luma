import {drizzle} from "drizzle-orm/node-postgres";
import * as schema from "./schema";
export function getDb(){if(!process.env.DATABASE_URL)throw Error("DATABASE_URL is required");return drizzle(process.env.DATABASE_URL,{schema});}
