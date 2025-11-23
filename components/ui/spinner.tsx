import { Loader2 } from "lucide-react";

export const Spinner = () => {
  return <Loader2 className="h-4 w-4 animate-spin" />;
};

export const FullScreenLoader = () => {
  return (
    <div className="flex h-full w-full items-center justify-center p-12">
      <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
    </div>
  );
};

