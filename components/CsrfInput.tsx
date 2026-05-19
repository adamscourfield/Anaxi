/** Hidden CSRF field for server-rendered forms (god mode, etc.). */
export function CsrfInput({ token }: { token: string }) {
  return <input type="hidden" name="_csrf" value={token} />;
}
