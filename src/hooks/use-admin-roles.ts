"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { apiGet, apiPatch, apiPost } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { AdminEmployeeRow, AdminRoleOption } from "@/lib/types/api";
import { useApiToast } from "@/components/ui/ToastProvider";

export type CreateEmployeePayload = {
  employeeCode?: string;
  name: string;
  email: string;
  roleCode: string;
  password: string;
};

export type UpdateEmployeePayload = {
  name?: string;
  email?: string;
  roleCode?: string;
  active?: boolean;
  password?: string;
};

export function useAdminEmployees(enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.employees,
    queryFn: () => apiGet<AdminEmployeeRow[]>("/api/admin/employees"),
    enabled,
  });
}

export function useAdminRoles(enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.roles,
    queryFn: () => apiGet<AdminRoleOption[]>("/api/admin/roles"),
    enabled,
    staleTime: 5 * 60_000,
  });
}

function invalidateEmployees(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.employees });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.roles });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();
  const toast = useApiToast();

  return useMutation({
    mutationFn: (payload: CreateEmployeePayload) =>
      apiPost<AdminEmployeeRow>("/api/admin/employees", payload),
    onSuccess: (data) => {
      invalidateEmployees(queryClient);
      toast.success("Employee created", `${data.name} can sign in now`);
    },
    onError: (error) => toast.errorFromApi(error, "Could not create employee"),
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();
  const toast = useApiToast();

  return useMutation({
    mutationFn: ({ employeeId, ...payload }: UpdateEmployeePayload & { employeeId: number }) =>
      apiPatch<AdminEmployeeRow>(`/api/admin/employees/${employeeId}`, payload),
    onSuccess: (data) => {
      invalidateEmployees(queryClient);
      toast.success("Employee updated", `${data.name} saved`);
    },
    onError: (error) => toast.errorFromApi(error, "Could not update employee"),
  });
}

export type RolePermissionMatrix = {
  role: { id: number; code: string; name: string };
  permissions: Array<{ id: number; code: string; name: string; assigned: boolean }>;
};

export type FullRbacMatrix = {
  roles: Array<{
    id: number;
    code: string;
    name: string;
    displayName: string;
    employeeCount: number;
  }>;
  permissions: Array<{ id: number; code: string; name: string; description: string | null }>;
  matrix: Array<{
    permissionCode: string;
    permissionName: string;
    roles: Array<{ roleId: number; roleCode: string; assigned: boolean }>;
  }>;
};

export function useFullRbacMatrix(enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.rbacMatrix,
    queryFn: () => apiGet<FullRbacMatrix>("/api/admin/rbac-matrix"),
    enabled,
  });
}

export function useRolePermissionMatrix(roleId: number, enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.rolePermissions(roleId),
    queryFn: () => apiGet<RolePermissionMatrix>(`/api/admin/roles/${roleId}/permissions`),
    enabled: enabled && roleId > 0,
  });
}

export function useUpdateRolePermissions() {
  const queryClient = useQueryClient();
  const toast = useApiToast();
  const { update: updateSession } = useSession();

  async function refreshCurrentSession() {
    try {
      const fresh = await apiPost<{ permissions: string[]; roleCode: string | null }>(
        "/api/auth/refresh-session",
        {},
      );
      if (fresh.roleCode) {
        await updateSession({ permissions: fresh.permissions, roleCode: fresh.roleCode });
      }
    } catch {
      // Non-blocking — user can sign out/in if refresh fails.
    }
  }

  return useMutation({
    mutationFn: ({ roleId, permissionCodes }: { roleId: number; permissionCodes: string[] }) =>
      apiPatch<RolePermissionMatrix>(`/api/admin/roles/${roleId}/permissions`, {
        permissionCodes,
      }),
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.roles });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.rbacMatrix });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.rolePermissions(data.role.id) });
      await refreshCurrentSession();
      toast.success("Permissions saved", `${data.role.name} updated`);
    },
    onError: (error) => toast.errorFromApi(error, "Couldn't update permissions"),
  });
}

export function useRestoreRolePermissions() {
  const queryClient = useQueryClient();
  const toast = useApiToast();
  const { update: updateSession } = useSession();

  async function refreshCurrentSession() {
    try {
      const fresh = await apiPost<{ permissions: string[]; roleCode: string | null }>(
        "/api/auth/refresh-session",
        {},
      );
      if (fresh.roleCode) {
        await updateSession({ permissions: fresh.permissions, roleCode: fresh.roleCode });
      }
    } catch {
      // Non-blocking
    }
  }

  return useMutation({
    mutationFn: (roleId: number) =>
      apiPost<RolePermissionMatrix>(`/api/admin/roles/${roleId}/permissions/restore`, {}),
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.roles });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.rbacMatrix });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.rolePermissions(data.role.id) });
      await refreshCurrentSession();
      toast.success("Defaults restored", data.role.name);
    },
    onError: (error) => toast.errorFromApi(error, "Couldn't restore defaults"),
  });
}
