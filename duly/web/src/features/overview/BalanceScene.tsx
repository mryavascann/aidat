/** Decorative brand imagery; balances and controls never depend on this asset. */
export function BalanceScene() {
  return (
    <div className="balance-scene" aria-hidden="true">
      <img
        src="/images/duly-shared-fund.webp"
        srcSet="/images/duly-shared-fund-672.webp 672w, /images/duly-shared-fund-1008.webp 1008w, /images/duly-shared-fund.webp 1344w"
        sizes="(max-width: 700px) calc(100vw - 36px), (max-width: 980px) calc(100vw - 228px), (min-width: 1500px) 840px, 58vw"
        width="1344"
        height="752"
        alt=""
        fetchPriority="high"
        decoding="async"
        onError={(event) => {
          event.currentTarget.style.visibility = "hidden";
        }}
      />
    </div>
  );
}
