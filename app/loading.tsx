export default function Loading() {
  return (
    <div className="px-4 py-6 space-y-8 animate-pulse">
      <div className="rounded-2xl bg-gray-100 h-40" />
      <div className="space-y-3">
        <div className="h-5 w-28 bg-gray-100 rounded" />
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-2xl" />
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <div className="h-5 w-40 bg-gray-100 rounded" />
        <div className="h-24 bg-gray-100 rounded-2xl" />
      </div>
    </div>
  );
}
