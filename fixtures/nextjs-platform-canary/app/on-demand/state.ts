const state = globalThis as typeof globalThis & {
  gigadriveOnDemandValue?: number;
};

export const getOnDemandValue = () => state.gigadriveOnDemandValue ?? 0;

export const incrementOnDemandValue = () => {
  state.gigadriveOnDemandValue = getOnDemandValue() + 1;
  return state.gigadriveOnDemandValue;
};
