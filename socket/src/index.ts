// server
import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import { cors } from "hono/cors";
import { cleanYTData, getAllSongsInRoom } from "./lib/utils.js";
import { initkafka, producer } from "./lib/kafka-config.js";
import { redis } from "./lib/redis-config.js";
const app = new Hono();

app.use(
  cors({
    origin: "*",
  })
);

app.get("/test", (c) => {
  return c.text("Hello Hono!");
});

app.get("/api/search/yt/:searchTerm", async (c) => {
  const { searchTerm } = c.req.param();
  // call youtube
  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10&q=${encodeURIComponent(
      searchTerm
    )}&fields=items(id/videoId,snippet/title,snippet/description,snippet/channelTitle,snippet/thumbnails/high/url)&key=${
      process.env.YOUTUBE_API_KEY
    }`
  );
  if (!response.ok) {
    return c.json(
      {
        data: null,
      },
      404
    );
  }
  const data = await response.json();
  return c.json(
    {
      data: cleanYTData(data.items),
    },
    200
  );
});

// sockets code
const server = serve(
  {
    fetch: app.fetch,
    port: 3001,
  },
  (info) => {
    console.log(`Server is running: http://${info.address}:${info.port}`);
  }
);
const ioServer = new Server(server as HttpServer, {
  serveClient: false,
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

initkafka(ioServer);

ioServer.on("error", (err) => {
  console.log(err);
});

ioServer.on("connection", (socket) => {
  console.log(`${socket.id}: connected`);
  // Called when user join room

  socket.on("join-room", async (data) => {
    const { userId, roomId } = data;
    if (!userId || !roomId) {
      socket.emit("error", { message: "Missing userId or roomId" });
      return;
    }
    socket.join(roomId);
    const parsedSongs = await getAllSongsInRoom(roomId);
    socket.emit("sync-queue", parsedSongs);

    socket.emit("joined-room", roomId);
  });
  socket.on("add-song", async (data) => {
    // Get song IDs in room queue
    const songIds = await redis.lrange(`room:${data.room}:queue`, 0, -1);

    // Check duplicate videoId by fetching hashes one by one
    for (const id of songIds) {
      const songHash = await redis.hgetall(`song:${id}`);
      if (songHash.videoId === data.data.videoId) {
        socket.emit("error", { message: "Song already exists in room." });
        return;
      }
    }

    // No duplicate, send Kafka message
    await producer.send({
      topic: "song-events",
      messages: [
        {
          value: JSON.stringify({
            type: "add-song",
            roomId: data.room,
            song: data,
          }),
        },
      ],
    });
  });

  socket.on("toggle-like", async (data) => {
    //     {
    //   songId: '7b4a8d33-a6c6-486a-97b2-4328a4cb94e8',
    //   userId: 'p12fWNMnxZRZkU6NwDtZ3MmFKqBUcK6U',
    //   roomId: 'p12fWNMnxZRZkU6NwDtZ3MmFKqBUcK6U'
    // }
    await producer.send({
      topic: "song-events",
      messages: [
        {
          value: JSON.stringify({
            type: "toggle-like",
            roomId: data.roomId,
            data,
          }),
        },
      ],
    });
  });
  // when admin plays a song
  socket.on("play-song", async (data) => {
    if (data.userId !== data.roomId) {
      socket.emit("error", {
        message: "Only room owner can perform this action",
      });
      return;
    }
    console.log("playing song")
    await producer.send({
      topic: "song-events",
      messages: [
        {
          value: JSON.stringify({
            type: "play-song",
            roomId: data.roomId,
            data,
          }),
        },
      ],
    });
  });

  socket.on("clear-room", async (roomId) => {
    await producer.send({
      topic: "song-events",
      messages: [{ value: JSON.stringify({ type: "clear-room", roomId }) }],
    });
  });
});

// all events join-room joined-room error
