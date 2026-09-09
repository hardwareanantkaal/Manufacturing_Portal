import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Server Actions default to a 1MB body limit — too small for a real
      // ESP32/ESP8266 firmware .bin (commonly 1-4MB with WiFi+BT stacks).
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
