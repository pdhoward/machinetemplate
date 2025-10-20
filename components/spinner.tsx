import { LucideLoaderCircle } from "lucide-react";

const Spinner = () => {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <LucideLoaderCircle className="h-16 w-16 animate-spin text-gray-500" />
    </div>
  );
};

export { Spinner };
