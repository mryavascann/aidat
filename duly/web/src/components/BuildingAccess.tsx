import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Building2,
  Camera,
  Copy,
  ImagePlus,
  QrCode,
} from "lucide-react";
import type QrScanner from "qr-scanner";
import { buildingCopy } from "../i18n/building";
import { buildingLink, parseBuildingLink } from "../lib/building-access";
import { buildingSnapshot, type BuildingData } from "../lib/building";

export function JoinBuilding({
  lang,
  onJoin,
}: {
  lang: "tr" | "en";
  onJoin: (id: string) => void;
}) {
  const t = buildingCopy(lang);
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [camera, setCamera] = useState(false);
  const [preview, setPreview] = useState<{
    id: string;
    data: BuildingData;
  } | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const scanner = useRef<QrScanner | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const checking = useRef(false);
  const scanGeneration = useRef(0);
  const stopCamera = () => {
    scanGeneration.current++;
    scanner.current?.destroy();
    scanner.current = null;
    if (mounted.current) setCamera(false);
  };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stopCamera();
    };
  }, []);

  async function inspect(raw: string) {
    if (checking.current) return;
    checking.current = true;
    stopCamera();
    setLoading(true);
    setError("");
    setPreview(null);
    try {
      let id: string;
      try {
        id = parseBuildingLink(raw);
      } catch {
        throw new Error(t("invalidBuildingLink"));
      }
      let data: BuildingData;
      try {
        data = await buildingSnapshot(id);
      } catch {
        throw new Error(t("buildingUnavailable"));
      }
      if (mounted.current) setPreview({ id, data });
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    } finally {
      checking.current = false;
      if (mounted.current) setLoading(false);
    }
  }

  async function startCamera() {
    stopCamera();
    const generation = scanGeneration.current;
    setError("");
    setPreview(null);
    setCamera(true);
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
        throw new Error("Camera unavailable.");
      const { default: Scanner } = await import("qr-scanner");
      if (!mounted.current || generation !== scanGeneration.current) return;
      const current = new Scanner(
        video.current!,
        (result) => void inspect(result.data),
        {
          preferredCamera: "environment",
          maxScansPerSecond: 5,
          returnDetailedScanResult: true,
        },
      );
      scanner.current = current;
      await current.start();
      if (!mounted.current || generation !== scanGeneration.current)
        current.destroy();
    } catch {
      if (mounted.current && generation === scanGeneration.current) {
        stopCamera();
        setError(t("cameraUnavailable"));
      }
    }
  }

  async function scanFile(image: File) {
    stopCamera();
    setError("");
    setPreview(null);
    setLoading(true);
    try {
      const { default: Scanner } = await import("qr-scanner");
      const result = await Scanner.scanImage(image, {
        returnDetailedScanResult: true,
      });
      if (mounted.current) await inspect(result.data);
    } catch (error) {
      console.warn("QR image decoding failed:", error);
      if (mounted.current) setError(t("qrUnreadable"));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }

  return (
    <div className="v3-account">
      <p>{t("joinBuildingHelp")}</p>
      <div className="v3-qr-camera" hidden={!camera}>
        <video ref={video} muted playsInline aria-label={t("scanQr")} />
        <p className="v3-help">{t("cameraHint")}</p>
        <button className="button secondary full" onClick={stopCamera}>
          {t("stopCamera")}
        </button>
      </div>
      {!camera && (
        <div className="v3-qr-choice">
          <QrCode size={44} aria-hidden="true" />
          <button
            className="button full"
            disabled={loading}
            onClick={() => void startCamera()}
          >
            <Camera size={18} />
            {t("scanQr")}
          </button>
          <button
            className="button secondary full"
            disabled={loading}
            onClick={() => file.current?.click()}
          >
            <ImagePlus size={18} />
            {t("uploadQr")}
          </button>
          <input
            ref={file}
            hidden
            type="file"
            accept="image/*"
            aria-label={t("uploadQr")}
            onChange={(e) => {
              const image = e.target.files?.[0];
              e.target.value = "";
              if (image) void scanFile(image);
            }}
          />
        </div>
      )}
      <details className="v3-access-alternative">
        <summary>{t("pasteBuildingLink")}</summary>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void inspect(link);
          }}
        >
          <label>
            {t("buildingLink")}
            <input
              required
              type="text"
              value={link}
              autoComplete="off"
              spellCheck={false}
              placeholder="https://…/?building=…"
              disabled={loading}
              onChange={(e) => {
                setLink(e.target.value);
                setPreview(null);
                setError("");
              }}
            />
          </label>
          <button className="button secondary full" disabled={loading}>
            {t("findBuilding")}
          </button>
        </form>
      </details>
      {loading && (
        <p className="v3-help" role="status">
          {t("checkingBuilding")}
        </p>
      )}
      {error && (
        <p className="v3-field-error" role="alert">
          {error}
        </p>
      )}
      {preview && (
        <section
          className="v3-building-preview"
          aria-label={t("buildingFound")}
        >
          <Building2 size={26} />
          <h3>{preview.data.config.name}</h3>
          <p>
            {preview.data.config.seat_count} {t("fixedSeats").toLowerCase()}
          </p>
          <p className="v3-help">{t("joinRights")}</p>
          <button className="button full" onClick={() => onJoin(preview.id)}>
            {t("goToBuilding")}
            <ArrowRight size={17} />
          </button>
        </section>
      )}
    </div>
  );
}

export function ShareBuilding({
  lang,
  building,
  name,
}: {
  lang: "tr" | "en";
  building: string;
  name: string;
}) {
  const t = buildingCopy(lang);
  const url = buildingLink(location.origin, building);
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setQr("");
    import("qrcode")
      .then((QR) =>
        QR.toDataURL(url, {
          width: 280,
          margin: 3,
          errorCorrectionLevel: "M",
          color: { dark: "#19392f", light: "#ffffff" },
        }),
      )
      .then((result) => {
        if (active) setQr(result);
      })
      .catch(() => {
        if (active) setError(t("qrUnavailable"));
      });
    return () => {
      active = false;
    };
  }, [url, lang]);
  return (
    <div className="v3-account v3-share-building">
      <h3>{name}</h3>
      <p>{t("shareQrHelp")}</p>
      {qr ? (
        <img
          className="v3-share-qr"
          src={qr}
          alt={t("buildingQr")}
          width={280}
          height={280}
        />
      ) : (
        <p role="status">{t("loadingQr")}</p>
      )}
      <label>
        {t("buildingLink")}
        <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
      </label>
      <button
        className="button full"
        onClick={() => {
          void navigator.clipboard
            .writeText(url)
            .then(() => {
              setCopied(true);
              setError("");
            })
            .catch(() => setError(t("copyLinkManually")));
        }}
      >
        <Copy size={17} />
        {copied ? t("copied") : t("sharedLink")}
      </button>
      <p className="v3-help">{t("joinRights")}</p>
      {copied && (
        <span role="status" className="v3-help">
          {t("copied")}
        </span>
      )}
      {error && (
        <p role="alert" className="v3-field-error">
          {error}
        </p>
      )}
    </div>
  );
}
