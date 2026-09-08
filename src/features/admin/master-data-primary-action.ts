export type MasterDataPrimaryAction = {
  label: string;
  onClick: () => void;
} | null;

export type RegisterMasterDataPrimaryAction = (
  action: MasterDataPrimaryAction,
) => void;
