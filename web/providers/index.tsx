"use client";

import type { ReactNode } from "react";

import { ThemeProvider } from "./theme-provider";

export function Provider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute={"class"}
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
