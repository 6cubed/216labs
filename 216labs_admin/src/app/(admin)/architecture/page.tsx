import { ArchitectureDiagram } from "@/components/ArchitectureDiagram";

export const dynamic = "force-dynamic";

export default async function ArchitecturePage() {
  return (
    <section className="animate-fade-in">
      <ArchitectureDiagram />
    </section>
  );
}
