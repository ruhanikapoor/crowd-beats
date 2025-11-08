import { Container } from "@/components/ui/container";
import { AuthButton } from "@/features/auth/components/auth-button";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const data = await auth.api.getSession({
    headers: await headers(),
  });

  // if user session is present send user to "/dashboard"
  if (data) {
    redirect("/dashboard");
  }
  
  return (
    <Container className="h-full flex flex-col items-center justify-center px-4 text-center space-y-6 md:space-y-8">
      <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight">
        Welcome to <span className="font-gugi text-primary">Crowd-Beats</span>
      </h1>
      <p className="text-base sm:text-lg md:text-xl max-w-xl text-secondary-foreground">
        Join the party! Vote for songs, add your favorites, and control the
        playlist live.
      </p>
      <AuthButton />
    </Container>
  );
}
