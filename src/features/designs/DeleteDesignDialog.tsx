"use client";

import { type Query, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal, ModalAlert, ModalFooterActions } from "@/components/ui/Modal";
import { AppButton } from "@/components/ui/AppButton";
import { useApiToast } from "@/components/ui/ToastProvider";
import { apiDelete, apiGet } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

type DeletePreview = {
  allowed: boolean;
  reasons: Array<{ code: string; message: string }>;
  ideaRef: string;
  collectionName: string;
};

export function DeleteDesignDialog({
  designId,
  open,
  onClose,
  onDeleted,
}: {
  designId: string | null;
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const toast = useApiToast();
  const queryClient = useQueryClient();
  const previewQuery = useQuery({
    queryKey: queryKeys.designs.deletePreview(designId ?? ""),
    queryFn: () => apiGet<DeletePreview>(`/api/designs/${designId}/delete-preview`),
    enabled: open && !!designId,
  });

  const removeDesign = useMutation({
    mutationFn: () => apiDelete<{ deleted: boolean }>(`/api/designs/${designId}`),
    onSuccess: () => {
      toast.success("Design deleted", previewQuery.data?.ideaRef);
      onDeleted();

      // Per-id queries for this design (detail, delete-preview, images, …) would 404 if
      // refetched. Leave mounted ones alone (they unmount once onDeleted closes or
      // navigates; removing them while observed makes the observer refetch) and drop
      // the rest.
      const isDeletedDesign = (query: Query) =>
        query.queryKey[0] === queryKeys.designs.all[0] && query.queryKey[2] === designId;
      queryClient.removeQueries({ predicate: isDeletedDesign, type: "inactive" });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.designs.all,
        predicate: (query) => !isDeletedDesign(query),
      });
      // Task lists may still show this design's tasks; per-task queries are left alone.
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.my });
      void queryClient.invalidateQueries({ queryKey: ["tasks", "my-day"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.actionCenter });
    },
    onError: (error) => toast.errorFromApi(error, "Could not delete design"),
  });

  const preview = previewQuery.data;
  const blocked = preview?.allowed === false;

  return (
    <Modal
      open={open}
      title="Delete this design?"
      description="Use this only when the design was created by mistake and work has not started."
      onClose={onClose}
      size="sm"
      footer={
        <ModalFooterActions>
          <AppButton type="button" appVariant="ghost" size="sm" onClick={onClose}>
            Cancel
          </AppButton>
          <AppButton
            type="button"
            appVariant="danger"
            size="sm"
            disabled={
              !designId ||
              removeDesign.isPending ||
              previewQuery.isLoading ||
              previewQuery.isError ||
              blocked
            }
            onClick={() => designId && removeDesign.mutate()}
          >
            {removeDesign.isPending ? "Deleting…" : "Delete design"}
          </AppButton>
        </ModalFooterActions>
      }
    >
      <div className="space-y-3">
        {preview ? (
          <p className="text-sm text-muted-foreground">
            <strong>{preview.collectionName}</strong> ({preview.ideaRef})
          </p>
        ) : null}
        {previewQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Checking whether this design can be deleted…</p>
        ) : null}
        {previewQuery.isError ? (
          <ModalAlert variant="error">Could not check this design. Try again.</ModalAlert>
        ) : null}
        {preview?.allowed ? (
          <p className="text-sm text-muted-foreground">
            Tasks and files created with this design will be removed. This cannot be undone.
          </p>
        ) : null}
        {blocked ? (
          <div className="space-y-2">
            <ModalAlert variant="warning">
              This design cannot be deleted until the work below is cleared. Time that was logged
              stays on record.
            </ModalAlert>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {preview.reasons.map((reason) => (
                <li key={reason.code}>{reason.message}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
