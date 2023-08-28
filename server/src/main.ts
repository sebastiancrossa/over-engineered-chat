import dotenv from "dotenv";
import fastify from "fastify";

dotenv.config();

const PORT = parseInt(process.env.PORT || "3001", 10);
const HOST = process.env.HOST || "0.0.0.0";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;

if (!UPSTASH_REDIS_REST_URL) {
  throw new Error("UPSTASH_REDIS_REST_URL is required");
  process.exit(1);
}

async function buildServer() {
  const app = fastify();

  app.get("/healthcheck", async () => {
    return {
        status: "ok",
        port: PORT,
    }
  })

  return app;
}

async function main() {
  const app = await buildServer();

  try {
    await app.listen({
        port: PORT,
        host: HOST,
    });

    console.log(`Server is running on http://${HOST}:${PORT}`);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();
