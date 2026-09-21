import type { SceneTexture } from "@serendipity/catalog";
import { imagerySrc } from "../lib/imagery";

export function Scene({
  slug,
  family,
  texture,
  className,
  label,
}: {
  slug: string;
  family: string;
  texture?: SceneTexture | string;
  className?: string;
  label?: string;
}) {
  const photo = imagerySrc(slug);
  return (
    <div
      className={["scene", `fam-${family}`, `tex-${texture ?? "field"}`, `slug-${slug}`, photo ? "has-photo" : "", className]
        .filter(Boolean)
        .join(" ")}
      role="img"
      aria-label={label ?? slug.replaceAll("-", " ")}
    >
      <i className="s-sky" />
      <i className="s-mid" />
      <i className="s-fg" />
      <i className="s-mark" />
      {photo ? <img className="scene-photo" src={photo} alt="" /> : null}
    </div>
  );
}
