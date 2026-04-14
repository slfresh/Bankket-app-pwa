import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Banquet Ordering",
    short_name: "Banquet",
    description: "Hotel banquet ordering for waiters and kitchen",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#171717",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
