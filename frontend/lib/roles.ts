export const ROLE_HOME = {
  admin: "/admin",
  customer: "/client",
  provider: "/provider",
} as const;

export type UserRole = keyof typeof ROLE_HOME;

export function getRoleHome(role: UserRole): string {
  return ROLE_HOME[role];
}