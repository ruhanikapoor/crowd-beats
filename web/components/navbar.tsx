"use client";

import Link from "next/link";
import { AudioLines } from "lucide-react";

import { Button } from "./ui/button";

import { ModeToggle } from "./mode-toggle";
import { authClient } from "@/lib/auth-client";
import { Container } from "./ui/container";
import { cn } from "@/lib/utils";

export function Navbar({ className }: { className: string }) {
  const { data: session } = authClient.useSession();
  return (
    <header
      className={cn(
        "h-20 flex justify-center items-center border-b top-0 w-full bg-background",
        className
      )}
    >
      <Container className="flex items-center justify-center">
        <Link href={"/"} className="font-gugi font-bold text-base md:text-xl">
          Crowd Beats
        </Link>
        <div className="ml-auto flex justify-center items-center gap-2">
          {!session && (
            <Button className="rounded-full text-sm md:text-base" asChild>
              <Link href={"/login"} className="">
                <span className="flex justify-center items-center gap-2">
                  <AudioLines />
                  <p>Get Started</p>
                </span>
              </Link>
            </Button>
          )}
          <ModeToggle className="hidden md:inline" />
        </div>
      </Container>
    </header>
  );
}
