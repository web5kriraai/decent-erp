"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

export function useSuggestedEmployeeCode(enabled = false) {
  return useQuery({
    queryKey: queryKeys.admin.suggestCode,
    queryFn: () => apiGet<{ employeeCode: string }>("/api/admin/employees/suggest-code"),
    enabled,
    staleTime: 0,
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
      toast.success("Employee created", `${data.name} (${data.employeeCode}) can sign in now`);
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

export function useUpdateEmployeeRole() {
  const updateEmployee = useUpdateEmployee();
  return {
    ...updateEmployee,
    mutateAsync: ({ employeeId, roleCode }: { employeeId: number; roleCode: string }) =>
      updateEmployee.mutateAsync({ employeeId, roleCode }),
  };
}

export type RolePermissionMatrix = {
  role: { id: number; code: string; name: string };
  permissions: Array<{ id: number; code: string; name: string; assigned: boolean }>;
};

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

  return useMutation({
    mutationFn: ({ roleId, permissionCodes }: { roleId: number; permissionCodes: string[] }) =>
      apiPatch<RolePermissionMatrix>(`/api/admin/roles/${roleId}/permissions`, {
        permissionCodes,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.roles });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.rolePermissions(data.role.id) });
      toast.success("Permissions saved", data.role.name);
    },
    onError: (error) => toast.errorFromApi(error, "Could not update permissions"),
  });
}
