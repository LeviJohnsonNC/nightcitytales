import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { listCharacters } from "@/lib/backend";

export function RosterList() {
  const { data, isPending, error } = useQuery({
    queryKey: ["characters"],
    queryFn: listCharacters,
  });

  if (isPending) return <p className="text-sm text-muted-foreground">Loading roster…</p>;
  if (error) return <p className="text-sm text-destructive">{error.message}</p>;
  if (!data?.length)
    return <p className="text-sm text-muted-foreground">No characters yet.</p>;

  return (
    <ul className="space-y-1">
      {data.map((character) => (
        <li key={character.id}>
          <Link
            to="/character/$id"
            params={{ id: character.id }}
            className="text-sm underline underline-offset-4"
          >
            {character.name} — {character.role}
          </Link>
        </li>
      ))}
    </ul>
  );
}