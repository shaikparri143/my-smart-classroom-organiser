import { useState } from "react";
import { Download, ExternalLink, FileText } from "lucide-react";
import { apiDownload } from "../../services/api";
import { getAccessToken } from "../../services/auth";

export default function SubmissionResource({ resource }) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  if (resource.kind === "link") {
    return (
      <a
        className="assignment-resource-link"
        href={resource.external_url}
        target="_blank"
        rel="noreferrer"
      >
        <ExternalLink size={15} />
        <span>{resource.name}</span>
      </a>
    );
  }

  async function handleDownload() {
    setDownloading(true);
    setError("");
    try {
      const blob = await apiDownload(resource.download_url, {
        token: getAccessToken(),
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = resource.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (downloadError) {
      setError(downloadError.message || "Unable to download this attachment.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <span className="assignment-resource-item">
      <button
        className="assignment-resource-link assignment-resource-button"
        type="button"
        onClick={handleDownload}
        disabled={downloading}
      >
        {downloading ? <Download size={15} /> : <FileText size={15} />}
        <span>{downloading ? "Downloading..." : resource.name}</span>
      </button>
      {error && <small className="course-error" role="alert">{error}</small>}
    </span>
  );
}
