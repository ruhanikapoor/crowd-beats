"use client";

import Image from "next/image";

import { Button } from "@/components/ui/button";

import { authClient } from "@/lib/auth-client";

export function AuthButton() {
  const signIn = async () => {
    const data = await authClient.signIn.social({
      provider: "google",
    });
    if (data.error) {
      console.log(data.error.message);
      return;
    }
  };

  return (
    <Button className="" size={"lg"} variant={"outline"} onClick={signIn}>
      <Image
        alt={"google logo"}
        width={100}
        height={100}
        className="size-4"
        src={"/google-icon.svg"}
      />
      <span>Continue with Google</span>
    </Button>
  );
}
