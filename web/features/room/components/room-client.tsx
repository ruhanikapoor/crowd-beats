"use client";

import { useEffect, useState } from "react";
import { redirect, useParams, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Container } from "@/components/ui/container";
import { type User } from "better-auth";
import { Input } from "@/components/ui/input";
import { AddSongButton } from "./add-song-button";
import { useSocket } from "@/hooks/use-socket";

export function RoomClient() {
  const [user, setUser] = useState<null | User>(null);
  const socket = useSocket(); // use your custom socket hook

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

  // Join room and add event listeners after user is set and socket connected
  useEffect(() => {
    if (!user || !socket) return;

    // Emit join-room event when socket connects
    const onConnect = () => {
      socket.emit("join-room", { userId: user.id, roomId });
      console.log("Socket connected and join-room emitted");
    };
    socket.on("connect", onConnect);

    // Event listeners
    socket.on("joined-room", (data) => {
      console.log("Joined room confirmed:", data);
    });
    socket.on("error", (error) => {
      console.error("Socket error:", error);
    });

    // Cleanup event listeners on unmount or deps change
    return () => {
      socket.off("connect", onConnect);
      socket.off("joined-room");
      socket.off("error");
    };
  }, [user, roomId, socket]);

  const addSong = () => {
    // your addSong implementation here
  };

  return (
    <Container className="h-full w-full flex flex-col px-4 space-y-6 md:space-y-8 relative min-h-[calc(100dvh-5rem)]">
      <AddSongButton />
      <div className="flex-1 bg-green-300"></div>
      <div>{roomId}</div>
      <div>{isAdmin ? <p>Admin</p> : <p>not admin</p>}</div>
    </Container>
  );
}
