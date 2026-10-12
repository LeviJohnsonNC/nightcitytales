/** Two letters for a face with no picture: the first and last word of a name. */
export function initialsOf(name: string): string {
  const words = name.split(/[\s&"“”]+/).filter((w) => /[a-z]/i.test(w));
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[words.length - 1]![0]!).toUpperCase();
}
