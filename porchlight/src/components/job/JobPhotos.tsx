/** Swipeable photo strip for a job request. Renders nothing when there are none. */
export function JobPhotos({ images }: { images: string[] }) {
  if (images.length === 0) return null;

  return (
    <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4">
      {images.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element -- photos are
        // user-supplied URLs; next/image would need every host allowlisted.
        <img
          key={`${src}-${i}`}
          src={src}
          alt=""
          className={`h-52 shrink-0 snap-start rounded-card border border-line object-cover ${
            images.length === 1 ? "w-full" : "w-72"
          }`}
        />
      ))}
    </div>
  );
}
