export default function ProviderServicesLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="h-8 w-1/3 bg-gray-200 rounded-lg mb-2" />
      <div className="h-4 w-1/2 bg-gray-200 rounded mb-6" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-200 rounded-lg" />
        ))}
      </div>
      <div className="h-48 bg-gray-200 rounded-lg" />
    </div>
  );
}