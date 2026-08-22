const { prisma } = require('../config/db');

// Returns null for admin (no restriction - sees everything), or an array of
// branch IDs owned by this reception/manager account (possibly empty) otherwise.
// Used everywhere a branch-scoped endpoint needs to check "is this
// teacher/student/group inside one of MY branches".
const getOwnBranchIds = async (user) => {
  if (user.role === 'admin') return null;

  const where = user.role === 'reception'
    ? { receptionId: user.userId }
    : user.role === 'manager'
      ? { managerId: user.userId }
      : null;

  if (!where) return null;

  const branches = await prisma.branch.findMany({ where, select: { id: true } });
  return branches.map(b => b.id);
};

// Resolves the branch IDs a request may read, honouring an optional ?branchId=
// filter. Returns { branchIds, forbidden }:
//   - branchIds === null  -> admin with no filter: no restriction at all
//   - branchIds === []    -> account owns no branches: must return nothing
//   - forbidden === true  -> caller asked for a branch they do not own
// Centralising this is what keeps one center's data out of another's views;
// every list endpoint should go through it rather than rolling its own filter.
const resolveBranchScope = async (user, branchId) => {
  const ownBranchIds = await getOwnBranchIds(user);

  if (branchId) {
    if (ownBranchIds && !ownBranchIds.includes(branchId)) return { branchIds: null, forbidden: true };
    return { branchIds: [branchId], forbidden: false };
  }
  return { branchIds: ownBranchIds, forbidden: false };
};

// Prisma `where` fragments for each way a record hangs off a branch. Each
// returns {} when branchIds is null (admin, unrestricted).
const byBranch = (branchIds) => (branchIds ? { branchId: { in: branchIds } } : {});
// Students have no branchId of their own - they inherit it from their group.
const byGroupBranch = (branchIds) => (branchIds ? { group: { branchId: { in: branchIds } } } : {});

// A user row that may be a teacher (own branchId) or a student (group's branch).
const userBranchScope = (branchIds, role) => {
  if (!branchIds) return {};
  if (role === 'teacher') return byBranch(branchIds);
  if (role === 'student') return byGroupBranch(branchIds);
  if (role === 'manager') return { managedBranches: { some: { id: { in: branchIds } } } };
  if (role === 'reception') return { branches: { some: { id: { in: branchIds } } } };
  // No role filter: match anyone attached to these branches by either route.
  return {
    OR: [
      { branchId: { in: branchIds } },
      { group: { branchId: { in: branchIds } } },
      { managedBranches: { some: { id: { in: branchIds } } } },
      { branches: { some: { id: { in: branchIds } } } },
    ],
  };
};

module.exports = { getOwnBranchIds, resolveBranchScope, byBranch, byGroupBranch, userBranchScope };
