import { Board } from "@/components/board";
import { listPeople } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const people = await listPeople();
  return <Board initialPeople={people} />;
}
