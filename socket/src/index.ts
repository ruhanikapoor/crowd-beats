// server
import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import { cors } from "hono/cors";
import { cleanYTData } from "./lib/utils.js";
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
    const songs = await redis.lrange(`room:${roomId}:songs`, 0, -1);
    const parsedSongs = songs.map((s) => JSON.parse(s));
    console.log("Sync queue");
    socket.emit("test", null);
    socket.emit("sync-queue", parsedSongs);

    socket.emit("joined-room", roomId);
  });
  socket.on("add-song", async (data) => {
    const songsInRoom = await redis.lrange(`room:${data.room}:songs`, 0, -1);

    // Check if any song matches the incoming song's videoId
    const songExists = songsInRoom.some((songStr) => {
      const song = JSON.parse(songStr);
      return song.data.videoId === data.data.videoId;
    });

    if (songExists) {
      // Optionally emit an error or ignore adding duplicate
      socket.emit("error", { message: "Song already exists in room." });
      return;
    }

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
  socket.on("clear-room", async (roomId) => {
    await producer.send({
      topic: "song-events",
      messages: [{ value: JSON.stringify({ type: "clear-room", roomId }) }],
    });
  });
});

// all events join-room joined-room error
