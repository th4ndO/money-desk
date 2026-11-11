import type { MetadataRoute } from "next";

/** Lets phones install Money Desk to the home screen as a full-screen app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Money Desk",
    short_name: "Money Desk",
    description: "Personal pay-cycle budget.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f7f5",
    theme_color: "#0f6e3f",
    // Long-press the home-screen icon to jump straight to logging.
    shortcuts: [
      { name: "Log spending", short_name: "Log", url: "/#log", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Allocate", url: "/allocate", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
