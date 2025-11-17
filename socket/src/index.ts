// server
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import { cors } from "hono/cors";
const app = new Hono();

app.use(
  cors({
    origin: "*",
  })
);

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

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
  socket.on("join-room", (data) => {
    const { userId, roomId } = data;
    if (!userId || !roomId) {
      socket.emit("error", { message: "Missing userId or roomId" });
      return;
    }
    socket.join(roomId);
    console.log(
      `User ${userId} with socket id ${socket.id} joined room ${roomId}`
    );
    socket.emit("joined-room", { roomId });
  });
});

// all events join-room joined-room error
