// UploadContext.js
import { createContext, useState, useContext } from "react";

const UploadContext = createContext();

export const UploadProvider = ({ children }) => {
  const [uploads, setUploads] = useState([]);

  const addUpload = (file, uploadPromise) => {
    setUploads((prev) => [...prev, { file, progress: 0, promise: uploadPromise }]);
  };

  const updateProgress = (fileName, progress) => {
    setUploads((prev) =>
      prev.map((upload) =>
        upload.file.name === fileName ? { ...upload, progress } : upload
      )
    );
  };

  const removeUpload = (fileName) => {
    setUploads((prev) => prev.filter((upload) => upload.file.name !== fileName));
  };

  return (
    <UploadContext.Provider value={{ uploads, addUpload, updateProgress, removeUpload }}>
      {children}
    </UploadContext.Provider>
  );
};

export const useUpload = () => useContext(UploadContext);