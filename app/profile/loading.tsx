export default function Loading() {
  return (
    <div className="px-4 py-6 space-y-4 animate-pulse">
      <div className="flex flex-col items-center gap-3">
        <div className="w-24 h-24 rounded-full bg-gray-100" />
        <div className="h-5 w-36 bg-gray-100 rounded" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-14 bg-gray-100 rounded-2xl" />
      ))}
    </div>
  );
}
