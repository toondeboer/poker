// src/app/generate-structure.tsx
import { useReportContentSettledOnMount } from "@/src/components/AppReadyGate";
import { GenerateStructureScreen } from "@/src/components/blinds/GenerateStructureScreen";

export default function GenerateStructureRoute() {
  useReportContentSettledOnMount();
  return <GenerateStructureScreen />;
}
