import "dotenv/config";

import { Kafka } from "kafkajs";
import { Server, type DefaultEventsMap } from "socket.io";
import { redis } from "./redis-config.js";
import { getAllSongsInRoom, getSong } from "./utils.js";

const isProduction = process.env.NODE_ENV === "production";
const kafkaUrl = process.env.KAFKA_URL!;

export const kafka = new Kafka({
  clientId: "app",
  brokers: isProduction ? [kafkaUrl] : ["localhost:9092"], // Docker Kafka
  ...(isProduction && {
    ssl: true,
    sasl: {
      mechanism: "plain", 
      username: process.env.KAFKA_USERNAME!,
      password: process.env.KAFKA_PASSWORD!,
    },
  }),
});
export const consumer = kafka.consumer({ groupId: "socket-group" });
export const producer = kafka.producer();

export async function initkafka(
  ioServer: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
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
              (id: string) => id !== tData.userId,
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

        case "play-next":
          const pnData = event.data;
          const roomKey = `room:${pnData.roomId}:queue`;

          // Get current queue BEFORE changes
          const currentQueue = await redis.lrange(roomKey, 0, -1);

          // Validate newSongId exists in queue
          if (!currentQueue.includes(pnData.newSongId)) {
            console.log("Invalid newSongId or last song, skipping");
            // Still remove old song if it exists
            await redis.lrem(roomKey, 0, pnData.oldSongId);
            await redis.del(`song:${pnData.oldSongId}`);
            const allSongs = await getAllSongsInRoom(pnData.roomId);
            ioServer.in(pnData.roomId).emit("sync-queue", allSongs);
            return;
          }

          //   Normal flow: remove old, mark new as played
          await redis.lrem(roomKey, 0, pnData.oldSongId);
          await redis.del(`song:${pnData.oldSongId}`);
          await redis.hset(`song:${pnData.newSongId}`, "isPlayed", "true");

          const allSongs = await getAllSongsInRoom(pnData.roomId);
          const newPlayingSong = await getSong(pnData.newSongId);

          ioServer.in(pnData.roomId).emit("play-song", newPlayingSong);
          ioServer.in(pnData.roomId).emit("sync-queue", allSongs);
          break;

        case "clear-queue":
          const roomId = event.roomId;
          const roomk = `room:${roomId}:queue`;

          //   1. Get all song IDs in queue
          const songIds = await redis.lrange(roomk, 0, -1);

          //   2. Delete all song hashes
          for (const songId of songIds) {
            await redis.del(`song:${songId}`);
          }

          //   3. Delete the entire queue list
          await redis.del(roomk);

          console.log(
            `Cleared queue for room ${roomId}, deleted ${songIds.length} songs`,
          );

          //   4. Notify all clients in room
          ioServer.in(roomId).emit("clear-queue");
          break;
      }
      console.timeEnd(
        `event-${event.type}-${event.data?.songId || event.roomId}`,
      );
    },
  });
}
