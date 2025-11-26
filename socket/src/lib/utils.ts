import type { Redis } from "ioredis";
import { redis } from "./redis-config.js";

export function cleanYTData(data: Array<any>) {
  return data.map((ytItem) => {
    const { id, snippet } = ytItem;
    return {
      videoId: id.videoId,
      image: snippet.thumbnails.high.url,
      title: snippet.title,
      description: snippet.description,
      author: snippet.channelTitle,
    };
  });
}

export async function getAllSongsInRoom(roomId: string) {
  const songIds = await redis.lrange(`room:${roomId}:queue`, 0, -1);

  // Fetch all songs hashes in parallel
  const songs = await Promise.all(
    songIds.map(async (id) => {
      const songHash = await redis.hgetall(`song:${id}`);
      return {
        id: songHash.id,
        author: songHash.author,
        authorId: songHash.authorId,
        room: songHash.room,
        isPlayed: songHash.isPlayed === "true",
        upvotes: Number(songHash.upvotes),
        upvotedBy: JSON.parse(songHash.upvotedBy || "[]"),
        data: {
          videoId: songHash.videoId,
          image: songHash.image,
          title: songHash.title,
          description: songHash.description,
          author: songHash.songAuthor,
        },
      };
    })
  );

  return songs;
}

export async function getSong(songId: string) {
  const songHash = await redis.hgetall(`song:${songId}`);

  // Parse fields
  return {
    id: songHash.id,
    author: songHash.author,
    authorId: songHash.authorId,
    room: songHash.room,
    isPlayed: songHash.isPlayed === "true",
    upvotes: Number(songHash.upvotes),
    upvotedBy: JSON.parse(songHash.upvotedBy || "[]"),
    data: {
      videoId: songHash.videoId,
      image: songHash.image,
      title: songHash.title,
      description: songHash.description,
      author: songHash.songAuthor,
    },
  };
}
