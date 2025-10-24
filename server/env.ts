import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
console.log("Loaded .env from:", path.resolve(process.cwd(), ".env"));
