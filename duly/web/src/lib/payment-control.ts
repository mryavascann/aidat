// A stop prevents the next payment stage. The current request is still awaited
// so its receipt is saved and the payment lock cannot be released too early.
export function createPaymentControl<T>() {
  let stopped: Promise<{ value: T } | { error: unknown }> | null = null;
  return {
    get stopped() {
      return stopped !== null;
    },
    requestStop(action: () => Promise<T>) {
      stopped ??= Promise.resolve()
        .then(action)
        .then(
          (value) => ({ value }),
          (error) => ({ error }),
        );
    },
    async finish(): Promise<T> {
      if (!stopped) throw new Error("No payment stop was requested.");
      const result = await stopped;
      if ("error" in result) throw result.error;
      return result.value;
    },
  };
}
export type PaymentControl<T> = ReturnType<typeof createPaymentControl<T>>;
