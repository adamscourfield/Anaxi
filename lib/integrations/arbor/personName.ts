type ArborPersonName = {
  preferredFirstName: string | null;
  preferredLastName: string | null;
  legalFirstName: string | null;
  legalLastName: string | null;
};

// Arbor can return empty preferred names rather than null.
export function arborPersonName(person: ArborPersonName): string {
  return [
    person.preferredFirstName?.trim() || person.legalFirstName?.trim(),
    person.preferredLastName?.trim() || person.legalLastName?.trim(),
  ].filter(Boolean).join(" ");
}
