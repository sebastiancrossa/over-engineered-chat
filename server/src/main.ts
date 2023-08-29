import dotenv from "dotenv";
import fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyIO from "fastify-socket.io";
import { Redis } from "ioredis";

dotenv.config();

const PORT = parseInt(process.env.PORT || "3001", 10);
const HOST = process.env.HOST || "0.0.0.0";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;

const CONNECTION_COUNT_CHANNEL = "chat:connection-count";

if (!UPSTASH_REDIS_REST_URL) {
  throw new Error("UPSTASH_REDIS_REST_URL is required");
  process.exit(1);
}

const publisher = new Redis(UPSTASH_REDIS_REST_URL);
const subscriber = new Redis(UPSTASH_REDIS_REST_URL);

async function buildServer() {
  const app = fastify();

  // cors setup (the usual)
  await app.register(fastifyCors, {
    origin: CORS_ORIGIN,
  });

  await app.register(fastifyIO);

  const currentCount = await publisher.get(CONNECTION_COUNT_CHANNEL);

  if (!currentCount) {
    await publisher.set(CONNECTION_COUNT_CHANNEL, 0);
  }

  // real-time socket setup
  app.io.on("connection", async (io) => {
    console.log("user connected");
    await publisher.incr(CONNECTION_COUNT_CHANNEL);

    io.on("disconnect", async () => {
      console.log("user disconnected");
      await publisher.decr(CONNECTION_COUNT_CHANNEL);
    });
  });

  app.get("/healthcheck", async () => {
    return {
      status: "ok",
      port: PORT,
    };
  });

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
