export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="h-52 bg-gray-100" />
      <div className="px-4 py-4 space-y-3">
        <div className="h-6 w-2/3 bg-gray-100 rounded" />
        <div className="h-4 w-1/2 bg-gray-100 rounded" />
        <div className="h-24 bg-gray-100 rounded-2xl" />
        <div className="h-12 bg-gray-100 rounded-xl" />
      </div>
    </div>
  );
}
