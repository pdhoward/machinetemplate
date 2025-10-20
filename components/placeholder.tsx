import { LucideMessageSquareWarning } from "lucide-react";
import { cloneElement } from "react";

type PlaceholderProps = {
  label: string;
  icon?: React.ReactElement<{ className?: string }>;
  button?: React.ReactElement<{ className?: string }>;
};

const Placeholder = ({
  label,
  icon = <LucideMessageSquareWarning />,
  button = <div />,
}: PlaceholderProps) => {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center justify-center gap-y-4 text-center">
        {cloneElement(icon, {
          className: "w-16 h-16 text-gray-500",
        })}
        <h2 className="text-lg font-medium text-gray-700">{label}</h2>
        {cloneElement(button, {
          className: "h-10 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100",
        })}
      </div>
    </div>
  );
};

export { Placeholder };
