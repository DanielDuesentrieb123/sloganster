"use client";

interface YouTubeEmbedProps {
  videoId: string;
}

export default function YouTubeEmbed({ videoId }: YouTubeEmbedProps) {
  return (
    <div className="w-full aspect-video rounded-xl overflow-hidden shadow-lg bg-black">
      <iframe
        width="100%"
        height="100%"
        src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
        title="Werbung"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="border-0"
      />
    </div>
  );
}
