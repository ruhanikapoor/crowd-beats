"use client";

import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { v4 as uuid } from "uuid";
import { useParams, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Container } from "@/components/ui/container";
import { type User } from "better-auth";
import { AddSongButton } from "./add-song-button";
import { SongQueue } from "./song-queue";
import { TSong } from "@/lib/types";

export function RoomClient() {
  const [user, setUser] = useState<null | User>(null);
  const [queue, setQueue] = useState<TSong[]>([]);
  const socketRef = useRef<Socket | null>(null);

  const router = useRouter();
  const { roomId } = useParams<{ roomId: string }>();

  if (!roomId) {
    router.replace("/rooms");
  }

  useEffect(() => {
    const getSession = async () => {
      const { data: session } = await authClient.getSession();
      if (!session) {
        return router.replace(`/login/rooms=${roomId}`);
      }
      setUser(session.user);
    };
    getSession();
  }, [roomId, router]);

  useEffect(() => {
    if (!user || !roomId) return;

    // Create socket connection directly
    const socket = io("http://localhost:3001", {
      // optional options here if needed
      autoConnect: false,
    });
    socketRef.current = socket;

    const onConnect = () => {
      socket.emit("join-room", { userId: user.id, roomId });
      console.log("Socket connected and join-room emitted");
    };

    // Register event listeners
    socket.on("connect", onConnect);

    socket.on("joined-room", (data) => {
      console.log("Joined room confirmed:", data);
    });

    socket.on("sync-queue", (data) => {
      console.log("Sync queue from server:", data);
      setQueue(data as TSong[]);
    });

    socket.on("new-song", (data: TSong) => {
      console.log("New song received", data);
      setQueue((prev) => [...prev, data]);
    });

    socket.on("error", (error) => {
      console.error("Socket error:", error);
      alert(JSON.stringify(error));
    });

    // Connect the socket
    socket.connect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("joined-room");
      socket.off("sync-queue");
      socket.off("new-song");
      socket.off("error");
      socket.disconnect();
    };
  }, [user, roomId]);

  const addSong = (data: object) => {
    if (!user || !socketRef.current) return;

    const payload = {
      id: uuid(),
      author: user.name,
      authorId: user.id,
      data,
      room: roomId,
      isPlayed: false,
      upvotes: 0,
    };
    socketRef.current.emit("add-song", payload);
  };

  return (
    <Container className="h-full w-full flex flex-col px-4 space-y-6 md:space-y-8 relative overflow-hidden max-h-[calc(100dvh-5rem)] min-h-[calc(100dvh-5rem)]">
      <AddSongButton addSong={addSong} />
      <SongQueue queue={queue} user={user!} />
      <div>{roomId}</div>
    </Container>
  );
}
