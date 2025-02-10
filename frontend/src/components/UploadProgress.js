// UploadProgress.js
import React from "react";
import { useUpload } from "./UploadContext";
import "./UploadProgress.css";

const UploadProgress = () => {
  const { uploads } = useUpload();

  return (
    <div className="upload-progress-container">
      {uploads.map((upload) => (
        <div key={upload.file.name} className="upload-item">
          <span>{upload.file.name}</span>
          <div className="progress-bar">
            <div className="progress" style={{ width: `${upload.progress}%` }}></div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default UploadProgress;