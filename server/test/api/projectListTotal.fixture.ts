import { describe, expect, mock, test } from "bun:test";

// My projects shows "12 projects" and "Page 1 of 2", so the list returns how
// many projects match across every page, counted with the same search as the
// page itself. The database is faked.

const rows = Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, name: `Project ${i}` }));
const counted: unknown[] = [];
const found: unknown[] = [];

mock.module("@/lib/prisma", () => ({
  prisma: {
    project: {
      findMany: async ({ where, take }: { where: unknown; take: number }) => {
        found.push(where);
        return rows.slice(0, take);
      },
      count: async ({ where }: { where: unknown }) => {
        counted.push(where);
        return rows.length;
      },
    },
  },
}));

const { listProjectsByUser } = await import("@/api/repositories/project.repository");

describe("listProjectsByUser", () => {
  test("returns the count of every match, not just this page", async () => {
    const page = await listProjectsByUser("u1", { limit: 6 });
    expect(page.projects).toHaveLength(6);
    expect(page.nextCursor).toBe("p5");
    expect(page.total).toBe(8);
  });

  test("counts with the same search as the page", async () => {
    counted.length = 0;
    found.length = 0;
    await listProjectsByUser("u1", { limit: 6, search: "notes" });
    expect(counted[0]).toEqual(found[0]);
    expect(JSON.stringify(counted[0])).toContain("notes");
  });
});
