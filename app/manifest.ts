import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HomeHQ", short_name: "HomeHQ",
    description: "Organiza tarefas, compras e despesas da tua casa.",
    start_url: "/", display: "standalone", background_color: "#f5f7f2", theme_color: "#f5f7f2",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
