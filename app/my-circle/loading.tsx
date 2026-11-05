export default function Loading() {
  return (
    <div className="px-4 py-4 space-y-4 animate-pulse">
      <div className="h-6 w-32 bg-gray-100 rounded" />
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-10 bg-gray-100 rounded-xl" />
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-32 bg-gray-100 rounded-2xl" />
      ))}
    </div>
  );
}
