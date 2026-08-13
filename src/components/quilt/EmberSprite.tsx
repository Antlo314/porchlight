"use client";

import { useEffect, useState } from "react";

const IDLE = [
  "/games/quilt/ember.png",
  "/games/quilt/ember-idle-2.png",
  "/games/quilt/ember-idle-3.png",
  "/games/quilt/ember-idle-2.png",
];
const TALK = [
  "/games/quilt/ember-talk.png",
  "/games/quilt/ember-idle-2.png",
];
const CHEER = [
  "/games/quilt/ember-cheer.png",
  "/games/quilt/ember.png",
];

export function EmberSprite({
  mood,
  className = "h-16 w-16",
}: {
  mood: "idle" | "talk" | "cheer";
  className?: string;
}) {
  const frames = mood === "cheer" ? CHEER : mood === "talk" ? TALK : IDLE;
  const [i, setI] = useState(0);

  useEffect(() => {
    setI(0);
    const ms = mood === "idle" ? 380 : 220;
    const id = window.setInterval(() => {
      setI((n) => (n + 1) % frames.length);
    }, ms);
    return () => window.clearInterval(id);
  }, [mood, frames.length]);

  const src = frames[i] ?? frames[0]!;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className={`${className} shrink-0 object-contain`}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).src = "/games/quilt/ember.png";
      }}
    />
  );
}
