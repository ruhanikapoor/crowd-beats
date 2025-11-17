"use client";

import { io, Socket } from "socket.io-client";
import { useEffect, useState } from "react";
import { redirect, useParams, useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";
import { Container } from "@/components/ui/container";
import { type User } from "better-auth";
import { Input } from "@/components/ui/input";

export function RoomClient() {
  const [user, setUser] = useState<null | User>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const { roomId } = useParams<{ roomId: string }>();

  if (!roomId) {
    router.replace("/rooms");
  }

  useEffect(() => {
    const getSession = async () => {
      const { data: session } = await authClient.getSession();

      if (!session) {
        return redirect(`/login/rooms=${roomId}`);
      }

      setIsAdmin(session.user.id === roomId);
      setUser(session.user);
    };
    getSession();
  }, [roomId]);

  // Use effect that runs when user is set
  useEffect(() => {
    if (!user) return;

    // Connect to Socket.IO server
    const socketClient = io("http://localhost:3001");

    // Emit join-room event after connection
    socketClient.on("connect", () => {
      socketClient.emit("join-room", { userId: user.id, roomId });
      console.log("Socket connected and join-room emitted");
    });

    // Example listeners
    socketClient.on("joined-room", (data) => {
      console.log("Joined room confirmed:", data);
    });

    socketClient.on("error", (error) => {
      console.error("Socket error:", error);
    });

    setSocket(socketClient);

    // Cleanup socket connection on unmount
    return () => {
      socketClient.disconnect();
      setSocket(null);
    };
  }, [user, roomId]);

  return (
    <Container className="h-full flex flex-col px-4 space-y-6 md:space-y-8">
      <div>{roomId}</div>
      <div>{isAdmin ? <p>Admin</p> : <p>not admin</p>}</div>
      <Input placeholder="Enter Youtube URL..." className="focus:outline-none selection:bg-transparent my-2"/>
    </Container>
  );
}
