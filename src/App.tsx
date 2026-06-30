import { useState } from "react";
import { Header } from "./components/Header";
import { BottomNav } from "./components/BottomNav";
import { SearchForm } from "./components/SearchForm";
import { JapanResultView } from "./components/JapanResultView";
import { KoreaResultView } from "./components/KoreaResultView";

type ViewState = "search" | "results-japan" | "results-korea";

export default function App() {
  const [view, setView] = useState<ViewState>("search");
  const [searchParams, setSearchParams] = useState({ origin: "", destination: "", date: "" });
  const [error, setError] = useState<string | undefined>();

  const handleSearch = async (origin: string, destination: string, date: string, country: "japan" | "korea", bypassApi = false) => {
    setSearchParams({ origin, destination, date });
    
    if (bypassApi) {
      setError(undefined);
      if (country === "japan") setView("results-japan");
      if (country === "korea") setView("results-korea");
      return;
    }

    try {
      const res = await fetch(`/api/transit/search?origin=${origin}&destination=${destination}&country=${country}`);
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.message || data.error || "Failed to fetch real-time data.");
      } else {
        setError(undefined);
      }
    } catch (e) {
      setError("Network error connecting to transit API.");
    }

    if (country === "japan") setView("results-japan");
    if (country === "korea") setView("results-korea");
  };

  return (
    <div className="bg-slate-50 min-h-screen text-slate-900 font-sans selection:bg-orange-600 selection:text-white">
      <Header />
      
      {view === "search" && <SearchForm onSearch={handleSearch} />}
      
      {view === "results-japan" && (
        <JapanResultView 
          origin={searchParams.origin}
          destination={searchParams.destination}
          date={searchParams.date}
          error={error}
          onModify={() => setView("search")}
        />
      )}
      
      {view === "results-korea" && (
        <KoreaResultView 
          origin={searchParams.origin}
          destination={searchParams.destination}
          date={searchParams.date}
          error={error}
        />
      )}

      <BottomNav />
    </div>
  );
}
