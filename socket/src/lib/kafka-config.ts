import { Kafka } from "kafkajs";
import { Server, type DefaultEventsMap } from "socket.io";
import { redis } from "./redis-config.js";

export const kafka = new Kafka({
  clientId: "app",
  brokers: ["localhost:9092"],
});
export const consumer = kafka.consumer({ groupId: "socket-group" });
export const producer = kafka.producer();

export async function initkafka(
  ioServer: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>
) {
  await producer.connect();
  await consumer.connect();

  console.log("Kafka ready");

  await consumer.subscribe({ topic: "song-events", fromBeginning: false });
  consumer.run({
    eachMessage: async ({ topic, message }) => {
      const event = JSON.parse(message.value!.toString());

      switch (event.type) {
        case "add-song":
          await redis.rpush(
            `room:${event.roomId}:songs`,
            JSON.stringify(event.song)
          );
          ioServer.in(event.roomId).emit("new-song", event.song);
          break;

        case "clear-room":
          await redis.del(`room:${event.roomId}:songs`);
          ioServer.in(event.roomId).emit("clear-queue");
          break;
      }
    },
  });
}
