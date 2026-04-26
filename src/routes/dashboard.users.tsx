import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { ComingSoon } from "./dashboard.files";

export const Route = createFileRoute("/dashboard/users")({
  component: () => <ComingSoon icon={Users} title="Users" desc="User list, activity, and full chat history — coming in the next phase." />,
});
