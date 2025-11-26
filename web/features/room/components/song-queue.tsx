import { TSong } from "@/lib/types";
import { User } from "better-auth";
import { HeartIcon, HeartPulseIcon, User2Icon } from "lucide-react";
import { PlayingLines } from "./playing-lines";

export function SongQueue({
  queue,
  user,
  toggleLike,
}: {
  queue: TSong[];
  user: User;
  toggleLike: (songId: string) => void;
}) {
  return (
    <div className="h-full w-full flex-1  overflow-y-auto custom-scrollbar py-4">
      {queue.map((song) => {
        let likedByMe = false;
        if (song.upvotedBy && song.upvotedBy.includes(user.id))
          likedByMe = true;
        return (
          <div
            key={"queue" + song.id}
            className="flex items-center gap-4 hover:bg-accent hover:cursor-pointer w-full h-full border-b-2 first:border-t-2 p-2"
          >
            <img
              src={song.data.image}
              alt={song.data.title}
              className="w-30 aspect-video object-cover rounded object-center"
            />
            <div className="w-full">
              <p className="font-semibold line-clamp-2">{song.data.title}</p>
              <p className="text-sm font-extralight line-clamp-1 text-gray-700 dark:text-gray-400">
                {song.data.description}
              </p>
              <div className="flex justify-between items-center px-4">
                <p className="text-xs text-gray-600 dark:text-gray-200 font-bold flex justify-center items-center gap-2">
                  <User2Icon size={10} />
                  <span>{song.authorId === user.id ? "You" : song.author}</span>
                </p>
                {/* dont show for song that is playing */}
                {!song.isPlayed && (
                  <p
                    className="flex justify-center items-center gap-4"
                    onClick={() => {
                      console.log("like");
                      toggleLike(song.id);
                    }}
                  >
                    {likedByMe ? (
                      <HeartIcon
                        className="text-red-500 fill-red-500"
                        size={20}
                      />
                    ) : (
                      <HeartIcon className="" size={20} />
                    )}
                    {song.upvotes || 0}
                    {song.isPlayed && <PlayingLines />}
                  </p>
                )}
                {song.isPlayed && <PlayingLines />}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
