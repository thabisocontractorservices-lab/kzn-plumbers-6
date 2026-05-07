export function DashboardLoading() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="h-4 bg-gray-200 rounded w-1/2" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-gray-100 rounded-xl" />
          ))}
        </div>
        <div className="h-64 bg-gray-100 rounded-xl mt-6" />
      </div>
    </div>
  );
}
