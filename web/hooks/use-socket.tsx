// useSocket.tsx
import { getSocket } from "@/lib/socket";
import { useEffect, useState } from "react";

export function useSocket() {
  const [socket] = useState(getSocket());

  useEffect(() => {
    // add event listeners
    socket.on("connect", () => console.log("Connected"));

    return () => {
      socket.off("connect"); // cleanup listeners but do not disconnect
    };
  }, [socket]);

  return socket;
}
