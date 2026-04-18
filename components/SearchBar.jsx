"use client";

import { useState } from "react";

export default function SearchBar({ placeholder = "Search...", onSearch }) {
  const [query, setQuery] = useState("");
  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch?.(query);
  };
  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="px-3 py-2 rounded border border-border-theme bg-bg-primary text-sm"
      />
      <button type="submit" className="px-3 py-2 rounded bg-gold text-bg-primary text-sm font-semibold">
        Search
      </button>
    </form>
  );
}
