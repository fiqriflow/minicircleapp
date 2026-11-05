export default function Loading() {
  return (
    <div className="px-4 py-4 space-y-4 animate-pulse">
      <div className="h-11 bg-gray-100 rounded-xl" />
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-9 w-20 shrink-0 bg-gray-100 rounded-full" />
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-32 bg-gray-100 rounded-2xl" />
      ))}
    </div>
  );
}
