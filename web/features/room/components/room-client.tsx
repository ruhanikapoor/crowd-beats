"use client";
import YouTube, { YouTubeProps } from "react-youtube";
import { toast } from "sonner";
import { useEffect, useState, useRef, useMemo } from "react";
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
import MaxHeap from "heap-js";

export function RoomClient() {
  const [user, setUser] = useState<null | User>(null);
  const [queueHeap, setQueueHeap] = useState<MaxHeap<TSong> | null>(null);
  const [playingSong, setPlayingSong] = useState<TSong | null>(null);
  const [currentPlayingSong, setCurrentPlayingSong] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);

  const playerRef = useRef<any>(null);
  const socketRef = useRef<Socket | null>(null);
  const router = useRouter();
  const { roomId } = useParams<{ roomId: string }>();
  const playingSongRef = useRef(playingSong);

  useEffect(() => {
    playingSongRef.current = playingSong;
  }, [playingSong]);

  if (!roomId) {
    router.replace("/rooms");
  }

  // Comparator for max-heap - sort by upvotes desc, then id asc for stability
  const comparator = (a: TSong, b: TSong) => {
    if (b.upvotes !== a.upvotes) return b.upvotes - a.upvotes;
    return a.id.localeCompare(b.id);
  };

  // Build heap from an array of songs, excluding the playing song
  const buildHeapFromArray = (
    songs: TSong[],
    playingId: string | null = null
  ) => {
    const heap = new MaxHeap<TSong>(comparator);
    songs.forEach((song) => {
      if (song.id !== playingId) {
        heap.push(song);
      }
    });
    return heap;
  };

  // Remove duplicates by song id
  const uniqueById = (songs: TSong[]): TSong[] => {
    const seen = new Set<string>();
    const filtered = songs.filter((s) => {
      if (seen.has(s.id)) {
        return false;
      }
      seen.add(s.id);
      return true;
    });
    return filtered;
  };

  useEffect(() => {
    const getSession = async () => {
      const { data: session } = await authClient.getSession();
      if (!session) {
        router.replace(`/login?rooms=${roomId}`);
        return;
      }
      setUser(session.user);
    };
    getSession();
  }, [roomId, router]);

  useEffect(() => {
    if (!user || !roomId) return;

    const socket = io("http://localhost:3001", {});
    socketRef.current = socket;

    const onConnect = () => {
      socket.emit("join-room", { userId: user.id, roomId });
    };

    socket.on("connect", onConnect);

    socket.on("joined-room", (data) => {});

    socket.on("sync-first-queue", (songs: TSong[]) => {
      const uniqueSongs = uniqueById(songs);
      const playing =
        uniqueSongs.find((s) => s.isPlayed) || uniqueSongs[0] || null;
      setPlayingSong(playing);
      setCurrentPlayingSong(playing?.id || "");
      setQueueHeap(buildHeapFromArray(uniqueSongs, playing?.id || null));
    });

    socket.on("new-song", (song: TSong) => {
      setQueueHeap((prevHeap) => {
        const heap = prevHeap
          ? prevHeap.clone()
          : new MaxHeap<TSong>(comparator);

        if (!playingSongRef.current) {
          // Only stop player if admin AND player exists
          if (user?.id === roomId && playerRef.current) {
            try {
              playerRef.current.stopVideo();
            } catch (error) {}
          }
          setPlayingSong(song);
          setCurrentPlayingSong(song.id);
          setIsPlaying(true);
          setPlayerReady(false);
          return heap;
        }

        const exists = heap.toArray().some((s) => s.id === song.id);
        if (!song.isPlayed && !exists) {
          heap.push(song);
        }
        return heap;
      });
    });

    socket.on("play-song", (song: TSong) => {
      setQueueHeap((prevHeap) => {
        if (!prevHeap) return prevHeap;
        const newHeap = new MaxHeap<TSong>(comparator);
        prevHeap
          .toArray()
          .filter((s) => s.id !== song.id)
          .forEach((s) => newHeap.push(s));
        return newHeap;
      });

      if (playerRef.current) playerRef.current.stopVideo();
      setPlayingSong(song);
      setCurrentPlayingSong(song.id);
      setIsPlaying(true);
      setPlayerReady(false);
    });

    socket.on("play-next", (song: TSong) => {
      setQueueHeap((prevHeap) => {
        if (!prevHeap) return prevHeap;
        const newHeap = new MaxHeap<TSong>(comparator);
        prevHeap
          .toArray()
          .filter((s) => s.id !== song.id)
          .forEach((s) => newHeap.push(s));
        return newHeap;
      });
      if (playerRef.current) playerRef.current.stopVideo();
      setPlayingSong(song);
      setCurrentPlayingSong(song.id);
      setIsPlaying(true);
      setPlayerReady(false);
    });

    socket.on("sync-queue", (songs: TSong[]) => {
      const uniqueSongs = uniqueById(songs);
      const playing =
        uniqueSongs.find((s) => s.isPlayed) || uniqueSongs[0] || null;

      setQueueHeap(buildHeapFromArray(uniqueSongs, playing?.id || null));
      // Update playingSong and currentPlayingSong outside of setPlayingSong functional update

      if (user.id !== roomId) {
        if ((playingSong?.id || "") !== (playing?.id || "")) {
          setPlayingSong(playing);
          setCurrentPlayingSong(playing.id);
          setIsPlaying(true);
        }
      } else {
        if ((playingSong?.id || "") !== (playing?.id || "")) {
          // setPlayingSong(playing);
          // setCurrentPlayingSong(playing.id);
          setIsPlaying(true);
        }
      }
    });

    socket.on("toggle-like", (song: TSong) => {
      setQueueHeap((prevHeap) => {
        if (!prevHeap) return prevHeap;
        const temp: TSong[] = [];
        let updatedPlayingSong = playingSong;

        while (!prevHeap.isEmpty()) {
          const s = prevHeap.pop()!;
          if (s.id === song.id) {
            temp.push(song);
          } else {
            temp.push(s);
          }
        }

        const newHeap = new MaxHeap<TSong>(comparator);
        temp.forEach((s) => newHeap.push(s));

        if (playingSong && playingSong.id === song.id) {
          updatedPlayingSong = song;
          setPlayingSong(updatedPlayingSong);
        }

        return newHeap;
      });
    });

    socket.on("error", (error) => {
      // toast error : {message: string}
      toast.error(error.message || "Something went wrong");
      alert(JSON.stringify(error));
    });

    socket.on("clear-queue", () => {
      // Safely stop player only if it exists and is ready
      if (playerRef.current && playerReady) {
        try {
          playerRef.current.stopVideo();
        } catch (error) {}
      }

      // Clear all state
      setQueueHeap(null);
      setPlayingSong(null);
      setCurrentPlayingSong("");
      setIsPlaying(false);
      setPlayerReady(false);
    });

    socket.connect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("joined-room");
      socket.off("sync-queue");
      socket.off("sync-first-queue");
      socket.off("play-next");
      socket.off("new-song");
      socket.off("toggle-like");
      socket.off("play-song");
      socket.off("clear-queue");
      socket.off("error");
      socket.disconnect();
    };
  }, [user, roomId]);

  // useEffect(() => {
  //   if (!playerRef.current) return;
  //   const currentSong = getSongById(currentPlayingSong);
  //   if (currentSong?.data.videoId) {
  //     playerRef.current.loadVideoById(currentSong.data.videoId);
  //   }
  // }, [currentPlayingSong]);

  useEffect(() => {
    if (!playerRef.current || !playerReady) return;
    const currentSong = getSongById(currentPlayingSong);
    if (currentSong?.data.videoId) {
      try {
        // Double-check player is actually usable
        if (playerRef.current.getPlayerState !== undefined) {
          playerRef.current.loadVideoById(currentSong.data.videoId);
        }
      } catch (error) {
        setPlayerReady(false);
      }
    }
  }, [currentPlayingSong, playerReady]);

  function getSongById(id: string): TSong | undefined {
    if (playingSong?.id === id) return playingSong;
    if (!queueHeap) return undefined;
    const arr = queueHeap.toArray();
    return arr.find((song) => song.id === id) || undefined;
  }

  const sortedQueue = useMemo(() => {
    if (!queueHeap) return playingSong ? [playingSong] : [];
    const others = queueHeap.toArray().sort(comparator);
    return playingSong ? [playingSong, ...others] : others;
  }, [queueHeap, playingSong]);

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
    socketRef.current.emit("toggle-like", {
      songId,
      userId: user.id,
      roomId,
    });
  };

  const togglePlay = () => {
    if (
      !playerReady ||
      !playerRef.current ||
      sortedQueue.length <= 0 ||
      !socketRef.current
    ) {
      return;
    }

    const playerState = playerRef.current.getPlayerState();
    if (playerState === 1) {
      playerRef.current.pauseVideo();
      setIsPlaying(false);
    } else {
      playerRef.current.playVideo();
      playSong(currentPlayingSong);
      setIsPlaying(true);
    }
  };
  // used when 1. song is over 2. admin clicks on skip / play next button
  // takes old song id and new song id goes to socket and redis
  // removes the song from redis
  // set new song id isPlayed to true
  // returns
  const playNext = () => {
    if (!socketRef.current || !user || !playingSong) return;

    // Don't emit if no next song
    if (sortedQueue.length <= 1) {
      setPlayingSong(null);
      setCurrentPlayingSong("");
      setIsPlaying(false);
      socketRef.current.emit("clear-queue", { roomId, userId: user.id });
      return;
    }

    const oldSongId = playingSong.id;
    const newSongId = sortedQueue[1].id;
    setIsPlaying(false);

    socketRef.current.emit("play-next", {
      oldSongId,
      newSongId,
      roomId,
      userId: user.id,
    });
  };

  const playSong = (songId: string) => {
    if (!socketRef.current || !user) return;
    socketRef.current.emit("play-song", {
      roomId,
      songId,
      userId: user.id,
    });
  };

  const opts: YouTubeProps["opts"] = {
    height: "390",
    width: "640",
    playerVars: {
      controls: 0,
      disablekb: 1,
      enablejsapi: 1,
      fs: 0,
      autoplay: 1,
    },
  };

  const onReady: YouTubeProps["onReady"] = (event) => {
    playerRef.current = event.target;
    setPlayerReady(true);
  };

  if (!user || !roomId) {
    return <Container>Loading...</Container>;
  }

  return (
    <Container className="h-full w-full flex flex-col px-4 space-y-6 md:space-y-8 relative overflow-hidden max-h-[calc(100dvh-5rem)] min-h-[calc(100dvh-5rem)]">
      {user?.id === roomId && playingSong && playingSong.data?.videoId && (
        <div className="flex justify-center items-center w-full">
          <YouTube
            videoId={playingSong.data.videoId}
            opts={opts}
            onReady={onReady}
            key={playingSong.id}
            onEnd={() => {
              setIsPlaying(false);
              playNext();
            }}
            className="hidden"
          />
        </div>
      )}

      {user?.id === roomId && (
        <SongControls
          name={user.name}
          id={user.id}
          playNext={playNext}
          isPlaying={isPlaying}
          togglePlay={togglePlay}
          currentPlayingSong={currentPlayingSong}
        />
      )}

      <AddSongButton addSong={addSong} />
      <SongQueue
        queue={sortedQueue}
        user={user!}
        toggleLike={toggleLike}
        currentPlayingSong={currentPlayingSong}
      />
    </Container>
  );
}
