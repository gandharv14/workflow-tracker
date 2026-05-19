import { Board } from "@/components/board";
import { requireAuthUser } from "@/lib/auth";
import { listPeople } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await requireAuthUser();
  const people = await listPeople();
  return <Board initialPeople={people} currentUser={user} />;
}
