import { createFileRoute } from "@tanstack/react-router";
import { CheckSquare } from "lucide-react";
import { ComingSoon } from "./dashboard.files";

export const Route = createFileRoute("/dashboard/tasks")({
  component: () => <ComingSoon icon={CheckSquare} title="Tasks" desc="Convert messages into trackable tasks — coming in the next phase." />,
});
