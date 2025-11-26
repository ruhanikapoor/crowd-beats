import { Kafka } from "kafkajs";
import { Server, type DefaultEventsMap } from "socket.io";
import { redis } from "./redis-config.js";
import { getSong } from "./utils.js";

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
          // Save song data as hash
          await redis.hset(`song:${event.song.id}`, {
            id: event.song.id,
            author: event.song.author,
            authorId: event.song.authorId,
            room: event.song.room,
            isPlayed: event.song.isPlayed.toString(),
            upvotes: event.song.upvotes.toString(),
            upvotedBy: JSON.stringify(event.song.upvotedBy),
            videoId: event.song.data.videoId,
            image: event.song.data.image,
            title: event.song.data.title,
            description: event.song.data.description,
            songAuthor: event.song.data.author,
          });

          // Add song ID to room queue list
          await redis.rpush(`room:${event.roomId}:queue`, event.song.id);

          // Notify clients in room
          ioServer.in(event.roomId).emit("new-song", event.song);
          break;

        case "toggle-like":
          const { songId, userId, roomId } = event.data;
          const song = await getSong(songId);
          const { upvotedBy } = song;
          const isLikedByUser = upvotedBy.includes(userId);

          if (isLikedByUser) {
            // Remove the userId from the upvotedBy array
            song.upvotedBy = upvotedBy.filter((id: string) => id !== userId);
            song.upvotes -= 1;
          } else {
            // Add the userId
            song.upvotedBy.push(userId);
            song.upvotes += 1;
          }

          // After toggling, save back to Redis hash
          await redis.hset(`song:${songId}`, {
            upvotes: song.upvotes.toString(),
            upvotedBy: JSON.stringify(song.upvotedBy),
          });

          // send to all clients
          ioServer.in(event.roomId).emit("toggle-like", song);
          break;

        case "clear-room":
          await redis.del(`room:${event.roomId}:songs`);
          ioServer.in(event.roomId).emit("clear-queue");
          break;
      }
    },
  });
}
