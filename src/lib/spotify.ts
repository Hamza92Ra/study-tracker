import { z } from "zod";

const spotifyUrl = z.string().trim().max(500).url();
const spotifyId = /^[A-Za-z0-9]{22}$/;

export function parseSpotifyUrl(value: unknown) {
  const raw = spotifyUrl.parse(value);
  const url = new URL(raw);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "open.spotify.com" ||
    url.username ||
    url.password ||
    url.port ||
    url.hash
  ) {
    throw new Error(
      "Use a Spotify playlist or album link from open.spotify.com.",
    );
  }
  const parts = url.pathname.split("/").filter(Boolean);
  const path = parts[0] === "embed" ? parts.slice(1) : parts;
  if (
    path.length !== 2 ||
    !["playlist", "album"].includes(path[0]) ||
    !spotifyId.test(path[1])
  ) {
    throw new Error("Use a valid Spotify playlist or album link.");
  }
  const kind = path[0] as "playlist" | "album";
  const id = path[1];
  return {
    kind,
    id,
    url: `https://open.spotify.com/${kind}/${id}`,
    embedUrl: `https://open.spotify.com/embed/${kind}/${id}`,
  };
}
