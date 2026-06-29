import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getTrips } from "../api";

export default function TripDashboard() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cityFilter, setCityFilter] = useState("madrid");
  const { logout } = useAuth();
  const navigate = useNavigate();

  function fetchTrips(city) {
    setLoading(true);
    setError(null);
    getTrips(city || undefined)
      .then((data) => {
        setTrips(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }

  useEffect(() => {
    fetchTrips(cityFilter);
  }, []);

  function progress(t) {
    if (!t.totalActivitiesCount) return "0/0";
    return `${t.completedActivitiesCount ?? 0}/${t.totalActivitiesCount}`;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">My Trips</h1>
        <div className="flex gap-3">
          <button
            onClick={() => navigate("/trips/new")}
            className="bg-indigo-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-indigo-700 transition"
          >
            + New Trip
          </button>
          <button
            onClick={logout}
            className="text-sm text-gray-500 hover:text-red-600 transition self-center"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-6">
        <label className="text-sm text-gray-600 font-medium">City:</label>
        <input
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none"
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchTrips(cityFilter)}
          placeholder="e.g. madrid"
        />
        <button onClick={() => fetchTrips(cityFilter)} className="text-sm bg-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-300 transition">Filter</button>
      </div>

      {loading && <p className="text-gray-400 text-center py-20">Loading trips...</p>}
      {error && <p className="text-red-500 text-center py-20">{error}</p>}

      {!loading && !error && trips.length === 0 && (
        <div className="text-center py-20">
          <p className="text-gray-400 text-lg mb-4">No trips yet</p>
          <button
            onClick={() => navigate("/trips/new")}
            className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition"
          >
            Create your first trip
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {trips.map((t) => (
          <div
            key={t.tripId}
            onClick={() => navigate(`/trips/${t.tripId}`)}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md hover:border-indigo-200 cursor-pointer transition"
          >
            <div className="flex justify-between items-start mb-2">
              <h2 className="text-lg font-semibold">{t.cityName}</h2>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{t.cityCode}</span>
            </div>
            <p className="text-sm text-gray-500 mb-3">
              {t.startDate} &rarr; {t.endDate}
            </p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-600">Activities:</span>
                <span className="font-medium">{progress(t)}</span>
              </div>
              <button onClick={(e) => { e.stopPropagation(); navigate(`/trips/${t.tripId}/edit`); }} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Edit</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
