// ObjectUploader component - based on blueprint:javascript_object_storage
import { useState, useEffect, useRef } from "react";
import Uppy from "@uppy/core";
import AwsS3 from "@uppy/aws-s3";
import { Dashboard } from "@uppy/react";
import { apiRequest } from "@/lib/queryClient";

import "@uppy/core/css/style.min.css";
import "@uppy/dashboard/css/style.min.css";

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
  // Use refs to store latest callback versions without triggering re-renders
  const onUploadCompleteRef = useRef(onUploadComplete);
  const onUploadErrorRef = useRef(onUploadError);

  useEffect(() => {
    onUploadCompleteRef.current = onUploadComplete;
    onUploadErrorRef.current = onUploadError;
  }, [onUploadComplete, onUploadError]);

  // Create Uppy instance during render so Dashboard always has a valid instance
  const [uppy] = useState(() =>
    new Uppy({
      restrictions: {
        maxFileSize,
        maxNumberOfFiles: 1,
        allowedFileTypes,
      },
      autoProceed: false,
    })
  );

  useEffect(() => {
    uppy.use(AwsS3, {
      id: "AwsS3", // Add ID to make it removable
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

    const handleUploadSuccess = async (file: any, response: any) => {
      if (!file) return;

      const uploadURL = response?.uploadURL;
      if (!uploadURL) return;

      try {
        const normalizeResponse = await apiRequest(
          "PUT",
          "/api/campaign-logo",
          { logoURL: uploadURL }
        );

        const data = await normalizeResponse.json() as { objectPath: string };
        onUploadCompleteRef.current?.(data.objectPath);
      } catch (error) {
        console.error("Error normalizing object path:", error);
        onUploadErrorRef.current?.(
          error instanceof Error
            ? error
            : new Error("Failed to normalize object path")
        );
      }
    };

    const handleUploadError = (file: any, error: any) => {
      console.error("Upload error:", error);
      onUploadErrorRef.current?.(
        error instanceof Error ? error : new Error("Upload failed")
      );
    };

    uppy.on("upload-success", handleUploadSuccess);
    uppy.on("upload-error", handleUploadError);

    return () => {
      uppy.off("upload-success", handleUploadSuccess);
      uppy.off("upload-error", handleUploadError);
      uppy.cancelAll();
      // Remove the AwsS3 plugin to prevent leaks
      const plugin = uppy.getPlugin("AwsS3");
      if (plugin) {
        uppy.removePlugin(plugin);
      }
    };
  }, [uppy]);

  return (
    <Dashboard
      uppy={uppy}
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
