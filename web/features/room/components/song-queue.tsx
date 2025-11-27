import { TSong } from "@/lib/types";
import { User } from "better-auth";
import {
  HeartIcon,
  User2Icon,
  PlusCircleIcon,
  Music,
  Volume2,
} from "lucide-react";
import { PlayingLines } from "./playing-lines";
import { v4 as uuid } from "uuid";

export function SongQueue({
  queue,
  user,
  toggleLike,
  currentPlayingSong,
}: {
  queue: TSong[];
  user: User;
  toggleLike: (songId: string) => void;
  currentPlayingSong: string;
}) {
  // Empty state when no songs
  if (queue.length === 0) {
    return (
      <div className="h-full w-full flex flex-col justify-center items-center text-center py-12 px-4 rounded-lg">
        <div className="w-24 h-24  rounded-2xl flex items-center justify-center mb-6 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50">
          <Music className="w-12 h-12 text-blue-500/80 opacity-80" />
        </div>

        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Queue is empty
        </h3>

        <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-sm leading-relaxed">
          Be the first to add a song and get the party started! 🎶
        </p>

        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-500 bg-white/50 dark:bg-gray-900/50 px-4 py-2 rounded-full backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50">
          <Volume2 className="w-4 h-4" />
          <span>Click the + button to add songs</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex-1 overflow-y-auto custom-scrollbar py-4">
      {queue.map((song) => {
        let likedByMe = false;
        if (song.upvotedBy && song.upvotedBy.includes(user.id))
          likedByMe = true;

        return (
          <div
            key={`queue-${song.id}`}
            className="flex items-center gap-4 hover:bg-accent hover:cursor-pointer w-full h-full border-b-2 first:border-t-2 p-2 transition-all duration-200"
          >
            <img
              src={song.data.image ?? "/placeholder.png"}
              alt={song.data.title ?? "Unknown"}
              className="w-30 aspect-video object-cover rounded object-center shrink-0"
            />
            <div className="w-full min-w-0 flex-1">
              <p className="font-semibold line-clamp-2 text-base">
                {song.data.title}
              </p>
              <p className="text-sm font-extralight line-clamp-1 text-gray-700 dark:text-gray-400">
                {song.data.description}
              </p>
              <div className="flex justify-between items-center px-4 mt-2">
                <p className="text-xs text-gray-600 dark:text-gray-200 font-bold flex items-center gap-2">
                  <User2Icon size={10} />
                  <span>{song.authorId === user.id ? "You" : song.author}</span>
                </p>

                {/* Like button - only show if not playing */}
                {!song.isPlayed && (
                  <button
                    className="flex items-center gap-2 p-2 hover:bg-red-50/50 dark:hover:bg-red-500/10 rounded-lg transition-all duration-200 -m-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLike(song.id);
                    }}
                  >
                    {likedByMe ? (
                      <HeartIcon
                        className="text-red-500 fill-red-500"
                        size={20}
                      />
                    ) : (
                      <HeartIcon
                        className="text-gray-400 hover:text-red-400"
                        size={20}
                      />
                    )}
                    <span className="font-bold text-sm">
                      {song.upvotes || 0}
                    </span>
                  </button>
                )}

                {song.isPlayed || currentPlayingSong === song.id ? (
                  <PlayingLines />
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
