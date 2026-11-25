import { Link } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function StoryEntryLink({ signedIn, className }: { signedIn: boolean; className: string }) {
  const style = cn(buttonVariants(), className);
  return signedIn ? (
    <Link to="/roster" className={style}>
      Choose a character
    </Link>
  ) : (
    <Link to="/login" search={{ mode: "signup" }} className={style}>
      Start your story
    </Link>
  );
}
