import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Fingerprint,
  Sparkles,
  Wallet,
} from "lucide-react";
import { buildingCopy } from "../i18n/building";
import { displayName } from "../lib/expense-form";

export function AccountAccess({
  lang,
  busy,
  pendingName,
  onCreate,
  onSignIn,
  onWallet,
  onDemo,
}: {
  lang: "tr" | "en";
  busy: boolean;
  pendingName?: string;
  onCreate: (name: string, method: "device" | "other") => void;
  onSignIn: (method: "device" | "other") => void;
  onWallet: () => void;
  onDemo: () => void;
}) {
  const t = buildingCopy(lang);
  const [mode, setMode] = useState<"create" | "signin">("create");
  const [step, setStep] = useState(1);
  const [name, setName] = useState(pendingName ?? "");
  const [error, setError] = useState(false);
  const [deviceReady, setDeviceReady] = useState<boolean | null>(null);
  const windows = /Windows/i.test(navigator.userAgent);
  useEffect(() => {
    let active = true;
    const check =
      window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable;
    if (!check) setDeviceReady(false);
    else
      void check.call(window.PublicKeyCredential).then(
        (ready) => {
          if (active) setDeviceReady(ready);
        },
        () => {
          if (active) setDeviceReady(false);
        },
      );
    return () => {
      active = false;
    };
  }, []);
  const nameRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (pendingName) setName(pendingName);
  }, [pendingName]);
  useEffect(() => {
    if (mode === "create") {
      if (step === 1) nameRef.current?.focus();
      else confirmRef.current?.focus();
    }
  }, [mode, step]);
  return (
    <div className="v3-account">
      <div
        className="v3-access-tabs"
        role="group"
        aria-label={t("accountChoice")}
      >
        <button
          className="button secondary"
          type="button"
          aria-pressed={mode === "create"}
          disabled={busy}
          onClick={() => {
            setMode("create");
            setError(false);
          }}
        >
          {t("newAccount")}
        </button>
        <button
          className="button secondary"
          type="button"
          aria-pressed={mode === "signin"}
          disabled={busy}
          onClick={() => {
            setMode("signin");
            setError(false);
          }}
        >
          {t("existingAccount")}
        </button>
      </div>
      {mode === "create" ? (
        <>
          {pendingName && (
            <p className="payment-notice">{t("accountCreationPending")}</p>
          )}
          <ol className="v3-access-steps" aria-label={t("accountSteps")}>
            <li aria-current={step === 1 ? "step" : undefined}>
              <span>{step === 2 ? <Check size={14} /> : "1"}</span>
              {t("yourName")}
            </li>
            <li aria-current={step === 2 ? "step" : undefined}>
              <span>2</span>
              {t("secureAccount")}
            </li>
          </ol>
          {step === 1 ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                try {
                  setName(displayName(name));
                  setError(false);
                  setStep(2);
                } catch {
                  setError(true);
                  nameRef.current?.focus();
                }
              }}
            >
              <div>
                <h3>{t("nameTitle")}</h3>
                <p className="v3-help">{t("nameHelp")}</p>
              </div>
              <label htmlFor="account-name">{t("accountLabel")}</label>
              <input
                id="account-name"
                data-autofocus
                ref={nameRef}
                required
                minLength={2}
                maxLength={40}
                autoComplete="nickname"
                placeholder={t("namePlaceholder")}
                value={name}
                readOnly={!!pendingName}
                disabled={busy}
                aria-describedby={error ? "account-name-error" : undefined}
                aria-invalid={!!error}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(false);
                }}
              />
              {error && (
                <p
                  id="account-name-error"
                  className="v3-field-error"
                  role="alert"
                >
                  {t("nameRequired")}
                </p>
              )}
              <button className="button full" disabled={busy}>
                {t("continue")}
                <ArrowRight size={17} />
              </button>
            </form>
          ) : (
            <div className="v3-account">
              <div className="v3-profile-summary">
                <span className="v3-card-icon">
                  <Fingerprint size={24} />
                </span>
                <div>
                  <span className="v3-help">{t("accountLabel")}</span>
                  <strong>{name}</strong>
                </div>
                <button
                  className="text-button"
                  disabled={busy || !!pendingName}
                  onClick={() => setStep(1)}
                >
                  {t("edit")}
                </button>
              </div>
              <p>{t("devicePasskeyHelp")}</p>
              {deviceReady === false && (
                <p className="payment-notice">
                  {t("devicePasskeyUnavailable")}
                </p>
              )}
              <button
                ref={confirmRef}
                className="button full"
                disabled={busy || (deviceReady === false && !pendingName)}
                onClick={() => onCreate(name, "device")}
              >
                <Fingerprint size={18} />
                {t(windows ? "useWindowsHello" : "useThisDevice")}
              </button>
              <button
                className="text-button"
                disabled={busy}
                onClick={() => setStep(1)}
              >
                <ArrowLeft size={15} />
                {t("back")}
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <span className="v3-passkey-icon">
            <Fingerprint size={36} />
          </span>
          <h3>{t("welcomeBack")}</h3>
          <p>{t("signInHelp")}</p>
          <p className="v3-help">{t("passkeyDeviceHelp")}</p>
          <button
            className="button full"
            disabled={busy}
            onClick={() => onSignIn("device")}
          >
            <Fingerprint size={18} />
            {t(windows ? "useWindowsHello" : "signIn")}
          </button>
        </>
      )}
      <details className="v3-access-alternative">
        <summary>{t("otherSignIn")}</summary>
        {(mode === "signin" || step === 2) && (
          <button
            className="text-button"
            disabled={busy || !!pendingName}
            onClick={() =>
              mode === "signin" ? onSignIn("other") : onCreate(name, "other")
            }
          >
            {t("useOtherDevice")}
          </button>
        )}
        <button className="text-button" disabled={busy} onClick={onWallet}>
          <Wallet size={16} />
          {t("existingWallet")}
        </button>
      </details>
      <button
        className="button secondary full"
        disabled={busy}
        onClick={onDemo}
      >
        <Sparkles size={17} /> {t("tryWithoutPasskey")}
      </button>
      <p className="v3-help">{t("passkeyLimit")}</p>
    </div>
  );
}
