import { Badge } from "@/components/ui";
import { JOB_STATUS_META, toJobStatus } from "./meta";

export function JobStatusBadge({ status }: { status: string }) {
  const meta = JOB_STATUS_META[toJobStatus(status)];
  return <Badge className={meta.className}>{meta.label}</Badge>;
}
