import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";

export const Route = createFileRoute("/dashboard/files")({
  component: () => (
    <ComingSoon icon={FileText} title="Files Hub" desc="All shared files, previews, and downloads — coming in the next phase." />
  ),
});

export function ComingSoon({ icon: Icon, title, desc }: { icon: React.ComponentType<{ className?: string }>; title: string; desc: string }) {
  return (
    <div className="h-full flex items-center justify-center p-8" style={{ background: "#0b141a" }}>
      <div className="text-center max-w-md animate-fade-up">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#00a884]/15 text-[#00a884] mb-4">
          <Icon className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-bold text-[#e9edef]">{title}</h2>
        <p className="mt-2 text-[#8696a0] text-sm">{desc}</p>
      </div>
    </div>
  );
}
