import type { MetadataRoute } from "next";

// Swap the icon files in public/icons/ for real branding later — everything
// else here stays the same.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Anantkaal Client Portal",
    short_name: "Anantkaal",
    description: "Manage your IoT devices, firmware updates, and sensor data.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#2563eb",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
