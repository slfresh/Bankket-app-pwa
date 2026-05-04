"use client";

import { Toaster } from "sonner";

export function StaffToaster() {
  return (
    <Toaster
      richColors
      position="top-center"
      closeButton
      toastOptions={{
        classNames: {
          toast: "font-sans",
        },
      }}
    />
  );
}
