"use client";
import YouTube, { YouTubeProps } from "react-youtube";
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
import { SongControls } from "./song-controls";

export function RoomClient() {
  const [user, setUser] = useState<null | User>(null);
  const [queue, setQueue] = useState<TSong[]>([]);
  const [currentPlayingSong, setCurrentPlayingSong] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const playerRef = useRef<any>(null);
  const socketRef = useRef<Socket | null>(null);
  const router = useRouter();
  const { roomId } = useParams<{ roomId: string }>();

  if (!roomId) {
    router.replace("/rooms");
  }
  // session check
  useEffect(() => {
    const getSession = async () => {
      const { data: session } = await authClient.getSession();
      if (!session) {
        return router.replace(`/login?rooms=${roomId}`);
      }
      setUser(session.user);
    };
    getSession();
  }, [roomId, router]);

  // socket
  useEffect(() => {
    if (!user || !roomId) return;

    // Create socket connection directly
    const socket = io("http://localhost:3001", {});
    socketRef.current = socket;

    const onConnect = () => {
      socket.emit("join-room", { userId: user.id, roomId });
      console.log("Socket connected and join-room emitted");
    };

    // Register event listeners
    socket.on("connect", onConnect);
    // confirmation on joining the room
    socket.on("joined-room", (data) => {
      console.log("Joined room confirmed:", data);
    });
    // sync the queue on first joining
    socket.on("sync-queue", (data: TSong[]) => {
      const sorted = sortQueue(data);
      setQueue(sorted);

      if (sorted.length > 0 && !currentPlayingSong && sorted[0].data?.videoId) {
        setCurrentPlayingSong(sorted[0].id);
      }
    });
    // someone added a new song
    socket.on("new-song", (data: TSong) => {
      setQueue((prev) => {
        // if no song was present then take the song and add it as playing song
        if (prev.length == 0) {
          setCurrentPlayingSong(data.id);
          // changePlayingSong
        }

        return [...prev, data];
      });
    });
    // when admin plays a song
    socket.on("play-song", (data: TSong) => {
      setQueue((prevQueue) => {
        let songChanged = false;
        const updatedQueue = prevQueue.map((song) => {
          if (song.id === data.id) {
            if (song.isPlayed !== data.isPlayed) {
              songChanged = true;
              return data;
            }
          }
          return song;
        });

        if (!songChanged) return prevQueue;

        const sortedQueue = sortQueue(updatedQueue);

        const isSameOrder =
          sortedQueue.length === prevQueue.length &&
          sortedQueue.every((song, index) => song.id === prevQueue[index].id);

        return isSameOrder ? prevQueue : sortedQueue;
      });
    });

    // when someone likes a song
    socket.on("toggle-like", (data: TSong) => {
      setQueue((prevQueue) => {
        let songChanged = false;

        // Map queue with updated song if it really changed
        const updatedQueue = prevQueue.map((song) => {
          if (song.id === data.id) {
            // Quick shallow check if anything changed
            if (
              song.upvotes !== data.upvotes ||
              song.upvotedBy.length !== data.upvotedBy.length
            ) {
              songChanged = true;
              return data;
            }
          }
          return song;
        });

        if (!songChanged) {
          // No change, return previous queue to avoid re-render
          return prevQueue;
        }

        const playingSong = updatedQueue.find((song) => song.isPlayed) || null;
        const otherSongs = updatedQueue.filter((song) => !song.isPlayed);

        // Sort others by upvotes descending
        const sortedOthers = [...otherSongs].sort(
          (a, b) => b.upvotes - a.upvotes
        );

        // Check if sorting changed the order
        const isOrderSame = sortedOthers.every(
          (song, index) => song.id === otherSongs[index].id
        );
        if (
          isOrderSame &&
          (!playingSong || prevQueue[0]?.id === playingSong.id)
        ) {
          // Order unchanged and playing song still on top: reuse previous array
          if (playingSong) return prevQueue;
          else return otherSongs; // no playing song case
        }

        // Return new array with playing song first if exists
        return playingSong ? [playingSong, ...sortedOthers] : sortedOthers;
      });
    });

    // if any error
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
      socket.off("toggle-like");
      socket.off("error");
      socket.disconnect();
    };
  }, [user, roomId]);

  function getSongById(id: string): TSong | undefined {
    return queue.find((song) => song.id === id);
  }

  function sortQueue(queue: TSong[]): TSong[] {
    // Separate playing song
    const playingSong = queue.find((song) => song.isPlayed) || null;
    const otherSongs = queue.filter((song) => !song.isPlayed);

    // Sort others by upvotes desc
    const sortedOthers = [...otherSongs].sort((a, b) => b.upvotes - a.upvotes);

    return playingSong ? [playingSong, ...sortedOthers] : sortedOthers;
  }

  const addSong = (data: object) => {
    if (!user || !socketRef.current) return;

    const payload = {
      id: uuid(),
      author: user.name,
      authorId: user.id,
      data,
      room: roomId,
      isPlayed: false,
      upvotes: 1,
      upvotedBy: [user.id],
    };
    socketRef.current.emit("add-song", payload);
  };

  const toggleLike = (songId: string) => {
    if (!user || !socketRef.current) return;
    const payload = {
      songId,
      userId: user.id,
      roomId,
    };
    socketRef.current.emit("toggle-like", payload);
  };

  const togglePlay = () => {
    if (!playerRef.current || queue.length <= 0 || !socketRef.current) return;

    const playerState = playerRef.current.getPlayerState();
    // Player state 1 means playing, 2 means paused
    if (playerState === 1) {
      playerRef.current.pauseVideo();
      setIsPlaying(false);
    } else {
      playerRef.current.playVideo();
      playSong(currentPlayingSong);
      setIsPlaying(true);
    }
  };
  const playNext = () => {};

  const playSong = (songId: string) => {
    if (!socketRef.current || !user) return;
    const payload = {
      roomId,
      songId,
      userId: user.id,
    };
    socketRef.current.emit("play-song", payload);
  };
  const opts: YouTubeProps["opts"] = {
    height: "390",
    width: "640",
    playerVars: {
      controls: 1, // Change later
      disablekb: 1,
      enablejsapi: 1,
      fs: 0,
      autoplay: 0,
    },
  };
  const onReady: YouTubeProps["onReady"] = (event) => {
    playerRef.current = event.target;
  };

  if (!user || !roomId) {
    return <Container>Loading...</Container>;
  }

  // Render player only if currentPlayingSong has valid videoId
  const currentSong = getSongById(currentPlayingSong);
  return (
    <Container className="h-full w-full flex flex-col px-4 space-y-6 md:space-y-8 relative overflow-hidden max-h-[calc(100dvh-5rem)] min-h-[calc(100dvh-5rem)]">
      {
        // check if admin
        user?.id === roomId && currentSong && (
          <YouTube
            videoId={getSongById(currentPlayingSong)?.data.videoId || ""}
            opts={opts}
            onReady={onReady}
          />
        )
      }
      {/* admin controls */}
      {user?.id === roomId && (
        <SongControls
          playNext={playNext}
          isPlaying={isPlaying}
          togglePlay={togglePlay}
          currentPlayingSong={getSongById(currentPlayingSong)?.id || ""}
        />
      )}
      <AddSongButton addSong={addSong} />
      <SongQueue queue={queue || []} user={user!} toggleLike={toggleLike} />
      {/* <div>{roomId}</div> */}
    </Container>
  );
}
