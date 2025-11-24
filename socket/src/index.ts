// server
import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import { cors } from "hono/cors";
import { cleanYTData } from "./lib/utils.js";
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
  console.log(response)

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

ioServer.on("error", (err) => {
  console.log(err);
});

ioServer.on("connection", (socket) => {
  console.log(`${socket.id}: connected`);
  // Called when user join room

  socket.on("join-room", (data) => {
    const { userId, roomId } = data;
    if (!userId || !roomId) {
      socket.emit("error", { message: "Missing userId or roomId" });
      return;
    }
    socket.join(roomId);
    socket.emit("joined-room", roomId);
  });
  socket.on("add-song", (data) => {
    // check if same id exists in redis
    socket.to(data.room).emit("new-song", data);
  });
});

// all events join-room joined-room error
