"use client";

import { useState, useEffect } from "react";

import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { PlusCircleIcon, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

import { backendUrl } from "@/lib/backend";

// Custom hook for debouncing a value with specified delay
function useDebounce(value: string, delay: number = 1000) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value.trim());
    }, delay);

    // Cleanup previous timeout if value changes before delay ends
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function AddSongButton({
  addSong,
}: {
  addSong: (data: object) => void;
}) {
  // State to hold user input from the search field
  const [searchTerm, setSearchTerm] = useState("");

  // Debounced search term to control API calls frequency
  const debouncedSearchTerm = useDebounce(searchTerm);

  // State to hold fetched videos from backend API
  const [videos, setVideos] = useState<any[]>([]);

  // Loading state to indicate fetch in progress
  const [isLoading, setIsLoading] = useState(false);

  // Error state to show any fetch errors
  const [error, setError] = useState<string | null>(null);

  // Fetch videos from backend API whenever debouncedSearchTerm changes
  useEffect(() => {
    // Clear videos and errors if search term is empty
    if (!debouncedSearchTerm) {
      setVideos([]);
      setError(null);
      return;
    }

    // Async function to fetch videos
    const fetchVideos = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Call backend API with encoded search term
        const response = await fetch(
          backendUrl +
            `/api/search/yt/${encodeURIComponent(debouncedSearchTerm)}`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch videos");
        }

        const res = await response.json();
        setVideos(res.data || []);
      } catch {
        setError("Something went wrong while fetching videos.");
        setVideos([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchVideos();
  }, [debouncedSearchTerm]);

  return (
    <Drawer
      onClose={() => {
        setSearchTerm("");
      }}
      onOpenChange={() => {
        setSearchTerm("");
      }}
    >
      <DrawerTrigger asChild>
        <Button
          variant="default"
          className="flex justify-center items-center gap-2 w-10 h-10 md:w-40 p-2 rounded-full md:rounded font-bold text-xl absolute bottom-0 right-10 z-20"
        >
          <PlusCircleIcon className="size-8" />
          <span className="hidden md:block">Add song</span>
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-sm md:max-w-2xl">
          <DrawerHeader>
            <DrawerTitle className="text-2xl md:text-4xl font-bold">
              Add Song
            </DrawerTitle>
            <DrawerDescription className="text-sm md:text-xl">
              Search for your favourite song
            </DrawerDescription>
          </DrawerHeader>
          <div className="w-full flex flex-col h-full gap-8">
            {/* Search input and button */}
            <div className="flex gap-2">
              <Input
                placeholder="Search your favourite song"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border-2 border-gray-200 dark:border-gray-900 shadow-none "
              />
              <Button
                disabled={isLoading}
                onClick={() =>
                  setSearchTerm(searchTerm.trim())
                } /* trigger immediate search */
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Searching...
                  </span>
                ) : (
                  "Search"
                )}
              </Button>
            </div>

            {/* Scrollable area to list videos or messages */}
            <ScrollArea className="h-96 w-full rounded-md border p-4 overflow-hidden flex justify-center items-center">
              {/* Display error message, if any */}
              {error && (
                <div className="text-sm text-muted-foreground flex justify-center items-center h-96 w-full">
                  {error}
                </div>
              )}
              {isLoading && (
                <div className="text-sm text-muted-foreground flex justify-center items-center h-96 w-full">
                  <Spinner />
                </div>
              )}

              {!isLoading && videos.length === 0 && !error && (
                <div className="text-sm text-muted-foreground flex justify-center items-center h-96 w-full">
                  No results. Try searching for a song.
                </div>
              )}

              {/* Render list of videos */}
              {!isLoading &&
                videos.map((video, index) => (
                  <div
                    key={video.videoId + index}
                    className="mb-4 flex items-center gap-4 hover:bg-accent hover:cursor-pointer p-4"
                    onClick={async() => {
                      await addSong(video);
                    }}
                  >
                    <img
                      src={video.image}
                      alt={video.author}
                      className="w-30 aspect-video object-cover rounded object-center"
                    />
                    <div>
                      <p className="font-semibold line-clamp-2">
                        {video.title}
                      </p>
                      <p className="text-sm font-extralight line-clamp-1 text-gray-700 dark:text-gray-400">
                        {video.description}
                      </p>
                      <p className="text-xs text-gray-600">{video.author}</p>
                    </div>
                  </div>
                ))}
            </ScrollArea>
          </div>
          <DrawerFooter></DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
