import dotenv from "dotenv";
import fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyIO from "fastify-socket.io";
import { Redis } from "ioredis";
import closeWithGrace from "close-with-grace";
import { randomUUID } from "crypto";

dotenv.config();

const PORT = parseInt(process.env.PORT || "3001", 10);
const HOST = process.env.HOST || "0.0.0.0";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;

const CONNECTION_COUNT_KEY = "chat:connection-count";
const CONNECTION_COUNT_UPDATED_CHANNEL = "chat:connection-count-updated"; // an actual channel
const NEW_MESSAGE_CHANNEL = "chat:new-message";

if (!UPSTASH_REDIS_REST_URL) {
  throw new Error("UPSTASH_REDIS_REST_URL is required");
  process.exit(1);
}

const publisher = new Redis(UPSTASH_REDIS_REST_URL);
const subscriber = new Redis(UPSTASH_REDIS_REST_URL);

// starting # of clients
let connectedClients = 0;

async function buildServer() {
  const app = fastify();

  // cors setup (the usual)
  await app.register(fastifyCors, {
    origin: CORS_ORIGIN,
  });

  await app.register(fastifyIO);

  const currentCount = await publisher.get(CONNECTION_COUNT_KEY);

  if (!currentCount) {
    await publisher.set(CONNECTION_COUNT_KEY, 0);
  }

  // real-time socket setup
  app.io.on("connection", async (io) => {
    console.log("user connected");

    const incrResult = await publisher.incr(CONNECTION_COUNT_KEY); // returns the new count, we need to propagate it to all clients
    connectedClients++;
    await publisher.publish(
      CONNECTION_COUNT_UPDATED_CHANNEL,
      String(incrResult)
    );

    io.on(NEW_MESSAGE_CHANNEL, async (payload) => {
      console.log("new message payload", payload);
      const { message } = payload;

      if (!message) return;

      await publisher.publish(NEW_MESSAGE_CHANNEL, message.toString()); // message is actually a buffer, so we want to convert to string
    });

    io.on("disconnect", async () => {
      console.log("user disconnected");
      const decrResult = await publisher.decr(CONNECTION_COUNT_KEY);
      connectedClients--;
      await publisher.publish(
        CONNECTION_COUNT_UPDATED_CHANNEL,
        String(decrResult)
      );
    });
  });

  // subscriber setup
  subscriber.subscribe(CONNECTION_COUNT_UPDATED_CHANNEL, (err, count) => {
    if (err) {
      console.error(
        `Error subscribing: ${CONNECTION_COUNT_UPDATED_CHANNEL}`,
        err
      );
      return;
    }

    console.log(
      `${count} clients subscribed to channel ${CONNECTION_COUNT_UPDATED_CHANNEL}`
    );
  });

  subscriber.subscribe(NEW_MESSAGE_CHANNEL, (err, count) => {
    if (err) {
      console.error(`Error subscribing: ${NEW_MESSAGE_CHANNEL}`, err);
      return;
    }

    console.log(
      `${count} clients subscribed to channel ${NEW_MESSAGE_CHANNEL}`
    );
  });

  // handles reception of all messages for all channels
  subscriber.on("message", (channel, text) => {
    console.log(`Received message on channel ${channel}: ${text}`);

    if (channel === CONNECTION_COUNT_UPDATED_CHANNEL) {
      app.io.emit(CONNECTION_COUNT_UPDATED_CHANNEL, {
        count: parseInt(text, 10),
      });
      return;
    }

    if (channel === NEW_MESSAGE_CHANNEL) {
      app.io.emit(NEW_MESSAGE_CHANNEL, {
        message: text,
        id: randomUUID(),
        createdAt: new Date(),
        port: PORT, // helps us with knowing what instance of the server the user was connected to
      });
      return;
    }
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

    closeWithGrace({ delay: 500 }, async () => {
      console.log("Server is closing...");

      if (connectedClients > 0) {
        console.log(
          `There are still connected clients, removing ${connectedClients} from the count...`
        );

        const currentCount = parseInt(
          (await publisher.get(CONNECTION_COUNT_KEY)) || "0",
          10
        );

        // make sure it doesn't go below 0
        const newCount = Math.max(currentCount - connectedClients, 0);

        await publisher.set(CONNECTION_COUNT_KEY, newCount);
      }

      await app.close();
      console.log("Server closed successfully");
    });

    console.log(`Server is running on http://${HOST}:${PORT}`);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();
