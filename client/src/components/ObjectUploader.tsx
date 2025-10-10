// ObjectUploader component - based on blueprint:javascript_object_storage
import { useEffect, useRef } from "react";
import Uppy from "@uppy/core";
import AwsS3 from "@uppy/aws-s3";
import { Dashboard } from "@uppy/react";
import { apiRequest } from "@/lib/queryClient";

import "@uppy/core/dist/style.min.css";
import "@uppy/dashboard/dist/style.min.css";

interface ObjectUploaderProps {
  onUploadComplete?: (objectPath: string) => void;
  onUploadError?: (error: Error) => void;
  maxFileSize?: number;
  allowedFileTypes?: string[];
}

export function ObjectUploader({
  onUploadComplete,
  onUploadError,
  maxFileSize = 10 * 1024 * 1024, // 10MB default
  allowedFileTypes = ["image/*"],
}: ObjectUploaderProps) {
  const uppyRef = useRef<Uppy | null>(null);

  useEffect(() => {
    const uppy = new Uppy({
      restrictions: {
        maxFileSize,
        maxNumberOfFiles: 1,
        allowedFileTypes,
      },
      autoProceed: false,
    });

    uppy.use(AwsS3, {
      shouldUseMultipart: false,
      async getUploadParameters(file) {
        const response = await apiRequest(
          "POST",
          "/api/objects/upload",
          { fileName: file.name }
        );

        const data = await response.json() as { uploadURL: string };

        return {
          method: "PUT",
          url: data.uploadURL,
          headers: {
            "Content-Type": file.type || "application/octet-stream",
          },
        };
      },
    });

    uppy.on("upload-success", async (file, response) => {
      if (!file) return;

      const uploadURL = (response as any).uploadURL;
      if (!uploadURL) return;

      try {
        const normalizeResponse = await apiRequest(
          "PUT",
          "/api/campaign-logo",
          { logoURL: uploadURL }
        );

        const data = await normalizeResponse.json() as { objectPath: string };
        onUploadComplete?.(data.objectPath);
      } catch (error) {
        console.error("Error normalizing object path:", error);
        onUploadError?.(
          error instanceof Error
            ? error
            : new Error("Failed to normalize object path")
        );
      }
    });

    uppy.on("upload-error", (file, error) => {
      console.error("Upload error:", error);
      onUploadError?.(
        error instanceof Error ? error : new Error("Upload failed")
      );
    });

    uppyRef.current = uppy;

    return () => {
      uppy.cancelAll();
      uppyRef.current = null;
    };
  }, [maxFileSize, allowedFileTypes, onUploadComplete, onUploadError]);

  return (
    <Dashboard
      uppy={uppyRef.current!}
      proudlyDisplayPoweredByUppy={false}
      height={300}
      locale={{
        strings: {
          dropPasteImportBoth: "Slipp filer her, lim inn, %{browseFiles} eller importer fra:",
          dropPasteImportFiles: "Slipp filer her, lim inn %{browseFiles} eller importer fra:",
          dropPasteBoth: "Slipp filer her, lim inn eller %{browseFiles}",
          dropPasteFiles: "Slipp filer her, lim inn eller %{browseFiles}",
          dropHint: "Slipp filene dine her",
          browseFiles: "bla gjennom filer",
          uploadXFiles: {
            0: "Last opp %{smart_count} fil",
            1: "Last opp %{smart_count} filer",
          },
          uploadXNewFiles: {
            0: "Last opp +%{smart_count} fil",
            1: "Last opp +%{smart_count} filer",
          },
          uploading: "Laster opp",
          complete: "Fullført",
          uploadFailed: "Opplasting mislyktes",
          paused: "Pauset",
          retry: "Prøv igjen",
          cancel: "Avbryt",
          filesUploadedOfTotal: {
            0: "%{complete} av %{smart_count} fil lastet opp",
            1: "%{complete} av %{smart_count} filer lastet opp",
          },
          dataUploadedOfTotal: "%{complete} av %{total}",
          xTimeLeft: "%{time} gjenstår",
          uploadingXFiles: {
            0: "Laster opp %{smart_count} fil",
            1: "Laster opp %{smart_count} filer",
          },
        },
      }}
    />
  );
}
