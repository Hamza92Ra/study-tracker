"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Music2, Plus, Trash2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import {
  addSpotifyLink,
  removeSpotifyLink,
  selectSpotifyLink,
  setSpotifyVisible,
} from "@/lib/spotify-actions";

type Link = { id: string; kind: string; spotifyId: string; label: string };
export function SpotifyWidget({
  links,
  selectedId,
  visible,
}: {
  links: Link[];
  selectedId: string | null;
  visible: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const selected = links.find((link) => link.id === selectedId) ?? links[0];
  async function run(
    action: () => Promise<{ ok: true } | { ok: false; error: string }>,
    success: string,
  ) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(success);
        router.refresh();
      }
    });
  }
  return (
    <section
      className="card manage-card spotify-widget"
      aria-label="Spotify study music"
    >
      <div className="panel-head spotify-head">
        <div>
          <span className="eyebrow">FOCUS SOUNDTRACK</span>
          <h3>
            <Music2 size={18} aria-hidden="true" /> Spotify study music
          </h3>
          <p className="panel-sub">Your saved playlists and albums</p>
        </div>
        <button
          type="button"
          className="button button-secondary"
          aria-label={visible ? "Hide Spotify player" : "Show Spotify player"}
          onClick={() =>
            run(
              () => setSpotifyVisible(!visible),
              visible ? "Player hidden" : "Player shown",
            )
          }
          disabled={pending}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
          <span>{visible ? "Hide" : "Show"}</span>
        </button>
      </div>
      {visible && (
        <>
          {links.length > 0 && (
            <div className="spotify-switcher">
              <label htmlFor="spotify-selection">Now selected</label>
              <select
                id="spotify-selection"
                value={selected?.id ?? ""}
                onChange={(event) =>
                  run(
                    () => selectSpotifyLink(event.target.value),
                    "Music changed",
                  )
                }
                disabled={pending}
              >
                {links.map((link) => (
                  <option key={link.id} value={link.id}>
                    {link.label} · {link.kind}
                  </option>
                ))}
              </select>
              <button
                className="tiny-button"
                type="button"
                aria-label="Remove selected Spotify link"
                disabled={pending}
                onClick={() =>
                  selected &&
                  run(() => removeSpotifyLink(selected.id), "Music removed")
                }
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
          {selected ? (
            <iframe
              key={selected.id}
              className="spotify-frame"
              title={`Spotify ${selected.kind}: ${selected.label}`}
              src={`https://open.spotify.com/embed/${selected.kind}/${selected.spotifyId}`}
              allow="encrypted-media; clipboard-write"
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : (
            <p className="spotify-empty">
              Add a Spotify playlist or album to keep your focus music close.
            </p>
          )}
          <form
            className="spotify-form"
            onSubmit={(event) => {
              event.preventDefault();
              run(async () => {
                const result = await addSpotifyLink({ url, label });
                if (result.ok) {
                  setUrl("");
                  setLabel("");
                }
                return result;
              }, "Music saved");
            }}
          >
            <div className="field">
              <label htmlFor="spotify-label">Name</label>
              <input
                id="spotify-label"
                className="input"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                maxLength={80}
                placeholder="Deep focus"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="spotify-url">Spotify link</label>
              <input
                id="spotify-url"
                className="input"
                type="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://open.spotify.com/playlist/..."
                required
              />
            </div>
            <button
              className="button button-primary"
              type="submit"
              disabled={pending}
            >
              <Plus size={16} /> Save
            </button>
          </form>
        </>
      )}
    </section>
  );
}
