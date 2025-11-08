"use client";

import { Button } from "@/components/ui/button";

import { authClient } from "@/lib/auth-client";

export function LogoutButton() {
  const logout = async () => {
    const data = await authClient.signOut();

    if (data.error) {
      alert(data.error.message);
      return;
    }
  };
  return <Button onClick={logout}>Logout</Button>;
}
