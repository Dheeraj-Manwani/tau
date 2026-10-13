/** Account changes affect every project's GitHub info and repository picker. */
export function isProjectGithubQuery(query: { queryKey: readonly unknown[] }) {
  return query.queryKey[0] === "project" && query.queryKey[2] === "github";
}
