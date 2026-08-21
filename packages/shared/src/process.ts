// The canonical manufacturing-process taxonomy. Shared by vendor onboarding /
// directory tags AND by requirement process categories, so a requirement and a
// vendor describe processes in identical terms and can be matched to each other.
// Kept as string[] because the onboarding checklist's field options are string[].
export const PROCESS_OPTIONS = [
  "HPDC",
  "Gravity Casting",
  "Forging",
  "CNC Turning",
  "VMC",
  "Sheet Metal",
  "Plating",
  "Heat Treatment",
];
