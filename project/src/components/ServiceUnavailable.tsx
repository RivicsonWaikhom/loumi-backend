import { PlugZap } from 'lucide-react';

interface ServiceUnavailableProps {
  title?: string;
  message: string;
  endpoint?: string;
}

export default function ServiceUnavailable({
  title = 'Analysis service not connected',
  message,
  endpoint,
}: ServiceUnavailableProps) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-pineapple-200 bg-pineapple-50 p-5 text-left">
      <div className="flex items-start gap-3">
        <PlugZap className="mt-0.5 h-5 w-5 shrink-0 text-pineapple-700" aria-hidden />
        <div>
          <p className="font-display font-semibold text-pineapple-900">{title}</p>
          <p className="mt-0.5 text-sm text-pineapple-800">{message}</p>
          {endpoint && (
            <p className="mt-2 font-mono text-xs text-pineapple-700/80 break-all">
              Endpoint: {endpoint}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
