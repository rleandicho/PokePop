export default function CardSkeleton() {
  return (
    <div
      className="rounded-2xl overflow-hidden shadow-md animate-pulse"
      style={{
        background: 'rgba(255,255,255,0.9)',
        border: '1px solid rgba(255,255,255,0.6)',
      }}
    >
      {/* Card image placeholder — matches ~2.5:3.5 Pokémon card ratio */}
      <div className="w-full bg-pink-100/60" style={{ aspectRatio: '5/7' }} />
      <div className="p-2 space-y-1.5">
        <div className="h-3 bg-pink-100/60 rounded-full w-3/4 mx-auto" />
        <div className="h-2.5 bg-pink-100/40 rounded-full w-1/2 mx-auto" />
        <div className="h-5 bg-pink-100/40 rounded-full w-2/3 mx-auto mt-1" />
      </div>
    </div>
  )
}
