import { useState } from "react";
import { Landmark } from "lucide-react";
import { buildingCopy } from "../i18n/building";
import { normalizeIban } from "../lib/iban";

export function ManagerBankForm({
  lang,
  initialIban = "",
  onSave,
}: {
  lang: "tr" | "en";
  initialIban?: string;
  onSave: (iban: string) => void;
}) {
  const t = buildingCopy(lang);
  const [iban, setIban] = useState(initialIban);
  const [error, setError] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        try {
          onSave(normalizeIban(iban));
        } catch {
          setError(t("invalidIban"));
        }
      }}
    >
      <span className="v3-passkey-icon">
        <Landmark size={30} />
      </span>
      <p className="v3-help">{t("managerIbanHelp")}</p>
      <label>
        {t("managerIban")}
        <input
          required
          autoFocus
          autoComplete="off"
          spellCheck={false}
          maxLength={34}
          placeholder="TR00 0000 0000 0000 0000 0000 00"
          value={iban}
          onChange={(e) => {
            setIban(e.target.value);
            setError("");
          }}
          aria-invalid={!!error}
          aria-describedby="manager-iban-help"
        />
      </label>
      <p id="manager-iban-help" className="v3-help">
        {t("managerIbanStorage")}
      </p>
      {error && (
        <p className="v3-field-error" role="alert">
          {error}
        </p>
      )}
      <button className="button full">{t("saveManagerIban")}</button>
    </form>
  );
}
