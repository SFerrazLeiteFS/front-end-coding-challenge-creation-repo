export interface Viewer {
  id: string;
  displayName: string;
}

/** Any non-empty bearer token is valid. The token itself names the user: "sam.lee" becomes "Sam Lee". */
export function viewerFromAuthorization(header: string | null): Viewer | null {
  const match = /^Bearer\s+(.*)$/i.exec(header ?? '');
  const token = match?.[1]?.trim();
  if (!token) return null;

  const displayName = token
    .split(/[-_.\s]+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(' ');

  return { id: `user-${token}`, displayName: displayName || token };
}
