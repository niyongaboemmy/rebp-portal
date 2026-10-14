/**
 * Official social profiles shown in the public footer.
 * TODO(REBP): replace each href with the Professional Body's real profile URL before launch;
 * these point at the platforms' home pages so nothing links to an account we do not own.
 */
export const SOCIAL = [
  { key: "x", label: "X", href: "https://x.com" },
  { key: "facebook", label: "Facebook", href: "https://www.facebook.com" },
  { key: "instagram", label: "Instagram", href: "https://www.instagram.com" },
  { key: "linkedin", label: "LinkedIn", href: "https://www.linkedin.com" },
  { key: "youtube", label: "YouTube", href: "https://www.youtube.com" },
] as const;

export type SocialKey = (typeof SOCIAL)[number]["key"];
