import React, { useState } from "react";

const SearchBar = ({ onSearch }) => {
  const [searchFileName, setSearchFileName] = useState("");

  const handleSearch = () => {
    if (!searchFileName.trim()) {
      alert("Debes ingresar un nombre de archivo (filename)");
      return;
    }
    onSearch(searchFileName.trim());
  };

  return (
    <div className="search-bar">
      <input
        type="text"
        placeholder="Buscar imagen por nombre..."
        value={searchFileName}
        onChange={(e) => setSearchFileName(e.target.value)}
      />
      <button onClick={handleSearch}>Buscar</button>
    </div>
  );
};

export default SearchBar;
