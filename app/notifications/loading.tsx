export default function Loading() {
  return (
    <div className="px-4 py-6 space-y-3 animate-pulse">
      <div className="h-6 w-40 bg-gray-100 rounded" />
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-16 bg-gray-100 rounded-2xl" />
      ))}
    </div>
  );
}
