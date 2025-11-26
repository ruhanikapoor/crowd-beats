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
      console.time(`event-${event.type}-${event.data?.songId || event.roomId}`);

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
          const tData = event.data;
          const tSong = await getSong(tData.songId);
          const { upvotedBy } = tSong;
          const isLikedByUser = upvotedBy.includes(tData.userId);

          if (isLikedByUser) {
            // Remove the userId from the upvotedBy array
            tSong.upvotedBy = upvotedBy.filter(
              (id: string) => id !== tData.userId
            );
            tSong.upvotes -= 1;
          } else {
            // Add the userId
            tSong.upvotedBy.push(tData.userId);
            tSong.upvotes += 1;
          }

          // After toggling, save back to Redis hash
          await redis.hset(`song:${tData.songId}`, {
            upvotes: tSong.upvotes.toString(),
            upvotedBy: JSON.stringify(tSong.upvotedBy),
          });
          // send to all clients
          ioServer.in(event.roomId).emit("toggle-like", tSong);
          break;

        case "play-song":
          const pSongData = event.data;
          const pSong = await getSong(pSongData.songId);
          if (pSong.isPlayed) return;
          pSong.isPlayed = true;
          await redis.hset(`song:${pSongData.songId}`, {
            isPlayed: JSON.stringify(true),
          });
          ioServer.in(event.roomId).emit("play-song", pSong);
          break;

        case "clear-room":
          await redis.del(`room:${event.roomId}:songs`);
          ioServer.in(event.roomId).emit("clear-queue");
          break;
      }
      console.timeEnd(
        `event-${event.type}-${event.data?.songId || event.roomId}`
      );
    },
  });
}
