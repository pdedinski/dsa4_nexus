"use client";

import { useEffect, useState } from "react";

type Props = {
  thumbnailUrl?: string | null;
  originalUrl: string;
  alt?: string;
  className?: string;
};

/** Prefer thumbnail URL; fall back to original on missing/error. */
export default function ThumbnailImage({
  thumbnailUrl,
  originalUrl,
  alt = "",
  className,
}: Props) {
  const preferred = thumbnailUrl?.trim() || originalUrl;
  const [src, setSrc] = useState(preferred);

  useEffect(() => {
    setSrc(thumbnailUrl?.trim() || originalUrl);
  }, [thumbnailUrl, originalUrl]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => {
        setSrc((current) => (current !== originalUrl ? originalUrl : current));
      }}
    />
  );
}
