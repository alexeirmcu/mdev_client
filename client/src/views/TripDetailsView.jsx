import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { getTripDetails, toggleCompletion, replanTrip } from "../api";

function computeArrows(positions) {
  const arrows = [];
  for (let i = 0; i < positions.length - 1; i++) {
    const [lat1, lng1] = positions[i];
    const [lat2, lng2] = positions[i + 1];
    const mid = [(lat1 + lat2) / 2, (lng1 + lng2) / 2];
    const angle = Math.atan2(lng2 - lng1, lat2 - lat1) * (180 / Math.PI);
    arrows.push({ position: mid, angle, key: i });
  }
  return arrows;
}

function arrowIcon(angle) {
  return L.divIcon({
    className: "",
    html: `<div style="transform:rotate(${angle}deg);font-size:14px;color:#ef4444;text-shadow:0 0 2px #fff,0 0 2px #fff;line-height:1;">&#9650;</div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function MapResizer({ fullMap: _fullMap }) {
  const map = useMap();
  useEffect(() => { map.invalidateSize(); }, [_fullMap, map]);
  return null;
}

const hotelIcon = L.divIcon({
  className: "",
  html: '<div style="background:#3b82f6;width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  popupAnchor: [0, -10],
});

function compactLabel(dayIndex, blockType, seq) {
  const day = dayIndex + 1;
  const block = blockType.charAt(0).toUpperCase();
  return `D${day}${block}${seq}`;
}

function makeActivityIcon(dayIndex, blockType, seq) {
  return L.divIcon({
    className: "",
    html: `<div style="background:#ef4444;width:36px;height:36px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:bold;line-height:1;letter-spacing:-0.5px;">${compactLabel(dayIndex, blockType, seq)}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
}

function minutesToTime(m) {
  if (m == null) return "";
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export default function TripDetailsView() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeDay, setActiveDay] = useState(0);
  const [fullMap, setFullMap] = useState(false);
  const [animIdx, setAnimIdx] = useState(-1);
  const animRef = useRef(null);
  const [completing, setCompleting] = useState(new Set());
  const [showReplan, setShowReplan] = useState(false);
  const [replanScope, setReplanScope] = useState("CurrentBlock");
  const [replanWeather, setReplanWeather] = useState(1);

  useEffect(() => {
    setLoading(true);
    setActiveDay(0);
    getTripDetails(tripId)
      .then((data) => {
        setTrip(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [tripId]);

  async function handleToggle(dayIndex, placeId, current) {
    const key = `${dayIndex}-${placeId}`;
    setCompleting((s) => new Set(s).add(key));
    try {
      const updated = await toggleCompletion(tripId, dayIndex, placeId, !current);
      setTrip((prev) => {
        if (!prev) return prev;
        const days = prev.days.map((d) => {
          if (d.dayIndex !== dayIndex) return d;
          const blocks = d.blocks.map((b) => {
            const activities = b.activities.map((a) => {
              if (a.placeId === placeId) return { ...a, isCompleted: !current };
              return a;
            });
            return { ...b, activities };
          });
          return { ...d, blocks };
        });
        return { ...prev, days };
      });
    } catch (err) {
      alert("Failed to update: " + err.message);
    } finally {
      setCompleting((s) => { const n = new Set(s); n.delete(key); return n; });
    }
  }

  const dayData = useMemo(() => {
    if (!trip?.days) return null;
    return trip.days.find((d) => d.dayIndex === activeDay) || null;
  }, [trip, activeDay]);

  const polylinePositions = useMemo(() => {
    if (!dayData || !trip?.baseHotel?.latitude) return [];
    const order = ["Morning", "Afternoon", "Evening"];
    const hotel = [trip.baseHotel.latitude, trip.baseHotel.longitude];
    const positions = [];
    let previousBlock;

    for (const blockType of order) {
      const block = dayData.blocks.find((b) => b.blockType === blockType);
      if (!block) continue;
      const activities = block.activities
        .filter((a) => a.location?.latitude != null)
        .sort((a, b) => a.sequenceOrder - b.sequenceOrder);
      if (activities.length === 0) continue;

      if (block.transitFromHotel) {
        if (previousBlock && previousBlock.interBlockTransit) {
          // previous block flowed directly here — no hotel insertion
        } else {
          positions.push(hotel);
        }
      }

      for (const a of activities) {
        positions.push([a.location.latitude, a.location.longitude]);
      }

      if (block.transitToHotel) {
        positions.push(hotel);
      }

      previousBlock = block;
    }

    return positions;
  }, [dayData, trip]);

  const arrows = useMemo(() => computeArrows(polylinePositions), [polylinePositions]);

  const handleAnimate = useCallback(() => {
    if (animRef.current) { clearInterval(animRef.current); animRef.current = null; }
    if (polylinePositions.length < 2) return;
    setAnimIdx(0);
    let i = 0;
    animRef.current = setInterval(() => {
      i++;
      setAnimIdx(i);
      if (i >= polylinePositions.length - 1) { clearInterval(animRef.current); animRef.current = null; }
    }, 400);
  }, [polylinePositions]);

  useEffect(() => {
    return () => { if (animRef.current) clearInterval(animRef.current); };
  }, []);

  const animatedPositions = useMemo(() => {
    if (animIdx < 0 || polylinePositions.length === 0) return [];
    return polylinePositions.slice(0, animIdx + 1);
  }, [animIdx, polylinePositions]);

  async function handleReplan() {
    if (!trip) return;
    setShowReplan(false);
    const now = new Date().toISOString();
    try {
      const updated = await replanTrip(tripId, now, replanScope, replanWeather);
      setActiveDay(0);
      setAnimIdx(-1);
      setTrip(updated);
    } catch (err) {
      alert("Replan failed: " + err.message);
    }
  }

  function markerLabel(dayIndex, blockType, seq) {
    return `Day ${dayIndex + 1} ${blockType} ${seq}`;
  }

  if (loading) return <p className="text-gray-400 text-center py-20">Loading trip...</p>;
  if (error) return <p className="text-red-500 text-center py-20">{error}</p>;
  if (!trip) return <p className="text-gray-400 text-center py-20">Trip not found</p>;

  return (
    <div className="h-screen flex flex-col">
      {/* HEADER */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/trips")} className="text-gray-500 hover:text-indigo-600 text-sm">&larr; Dashboard</button>
          <h1 className="text-lg font-bold">{trip.tripCode || "Trip"}</h1>
          <span className="text-sm text-gray-500">{trip.cityName} &middot; {trip.startDate} &rarr; {trip.endDate}</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${trip.status === "GENERATED" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{trip.status}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setFullMap((v) => !v)} className={`text-sm px-3 py-1.5 rounded-lg transition ${fullMap ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}>{fullMap ? "Split" : "Full Map"}</button>
          <button onClick={handleAnimate} disabled={polylinePositions.length < 2 || animRef.current} className="text-sm bg-teal-500 text-white px-3 py-1.5 rounded-lg hover:bg-teal-600 disabled:opacity-50 transition">Animate Path</button>
          {trip.status === "CREATED" && (
            <button onClick={() => navigate(`/trips/${trip.tripId}/edit`)} className="text-sm bg-indigo-500 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-600 transition">Edit Trip</button>
          )}
          <button onClick={() => setShowReplan(true)} className="text-sm bg-orange-500 text-white px-3 py-1.5 rounded-lg hover:bg-orange-600 transition">Smart Replan</button>
        </div>
      </header>

      {/* DAY TABS */}
      <div className="bg-white border-b border-gray-200 px-6 flex gap-1 overflow-x-auto shrink-0">
        {trip.days?.map((d) => (
          <button
            key={d.dayIndex}
            onClick={() => setActiveDay(d.dayIndex)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${activeDay === d.dayIndex ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            Day {d.dayIndex + 1}
            <span className="ml-1.5 text-xs opacity-60">({d.date})</span>
          </button>
        ))}
      </div>

      {/* BODY */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT — Itinerary */}
        <div className={`${fullMap ? "hidden" : "w-1/2"} overflow-y-auto border-r border-gray-200 p-6 space-y-6`}>
          {!dayData && <p className="text-gray-400 text-center py-10">No data for this day</p>}

          {dayData && (
            <>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>{dayData.date}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${dayData.weatherSummary === "Good" ? "bg-yellow-100 text-yellow-700" : dayData.weatherSummary === "Clear" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>{dayData.weatherSummary}</span>
              </div>

              {["Morning", "Afternoon", "Evening"].map((blockType) => {
                const block = dayData.blocks.find((b) => b.blockType === blockType);
                if (!block || !block.activities?.length) return null;
                return (
                  <div key={blockType}>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">{blockType}</h3>
                    <div className="space-y-2">
                      {block.activities
                        .slice()
                        .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
                        .map((a) => {
                          const busy = completing.has(`${dayData.dayIndex}-${a.placeId}`);
                          return (
                            <div key={a.placeId} className={`flex items-start gap-3 bg-white rounded-lg border p-3 text-sm ${a.isCompleted ? "border-green-200 bg-green-50" : "border-gray-200"}`}>
                              <input
                                type="checkbox"
                                checked={a.isCompleted}
                                disabled={busy}
                                onChange={() => handleToggle(dayData.dayIndex, a.placeId, a.isCompleted)}
                                className="mt-0.5"
                              />
                              <div className="flex-1 min-w-0">
                                <p className={`font-medium truncate ${a.isCompleted ? "line-through text-gray-400" : ""}`}>{a.placeName}</p>
                                <p className="text-xs text-gray-400">
                                  {minutesToTime(a.estimatedArrival)} &ndash; {minutesToTime(a.estimatedDeparture)}
                                  {a.durationMinutes ? ` (${a.durationMinutes}min)` : ""}
                                  {a.transitDurationMinutes ? ` &middot; transit ${a.transitDurationMinutes}min` : ""}
                                </p>
                              </div>
                              <span className="text-xs text-gray-400 shrink-0">#{a.sequenceOrder}</span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* RIGHT — Map */}
        <div className={`${fullMap ? "w-full" : "w-1/2"} h-full`}>
          {trip.baseHotel?.latitude != null && (
            <MapContainer center={[trip.baseHotel.latitude, trip.baseHotel.longitude]} zoom={14} className="h-full w-full">
              <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapResizer fullMap={fullMap} />

              <Marker position={[trip.baseHotel.latitude, trip.baseHotel.longitude]} icon={hotelIcon}>
                <Popup>{trip.baseHotel.name || "Base Hotel"}</Popup>
              </Marker>

              {dayData && ["Morning", "Afternoon", "Evening"].map((blockType) => {
                const block = dayData.blocks.find((b) => b.blockType === blockType);
                if (!block) return null;
                return block.activities
                  .filter((a) => a.location?.latitude != null)
                  .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
                  .map((a) => (
                    <Marker key={`${blockType}-${a.placeId}`} position={[a.location.latitude, a.location.longitude]} icon={makeActivityIcon(dayData.dayIndex, blockType, a.sequenceOrder)}>
                      <Popup>
                        <span className="text-sm font-medium">{markerLabel(dayData.dayIndex, blockType, a.sequenceOrder)}</span>
                        <br />
                        <span className="text-xs text-gray-500">{a.placeName}</span>
                      </Popup>
                    </Marker>
                  ));
              })}

              {polylinePositions.length > 1 && (
                <>
                  <Polyline positions={polylinePositions} pathOptions={{ color: "#fca5a5", weight: 2 }} />
                  {animIdx >= 0 && animatedPositions.length > 1 && (
                    <Polyline positions={animatedPositions} pathOptions={{ color: "#ef4444", weight: 4 }} />
                  )}
                  {arrows.map((a) => (
                    <Marker key={a.key} position={a.position} icon={arrowIcon(a.angle)} />
                  ))}
                </>
              )}
            </MapContainer>
          )}
          {(!trip.baseHotel?.latitude || !trip.baseHotel?.longitude) && (
            <div className="flex items-center justify-center h-full text-gray-400">Hotel location not available</div>
          )}
        </div>
      </div>

      {showReplan && (
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center" onClick={() => setShowReplan(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Smart Replan</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Scope</label>
                <select className="w-full border border-gray-300 rounded-lg p-2 text-sm" value={replanScope} onChange={(e) => setReplanScope(e.target.value)}>
                  <option value="CurrentBlock">Current Block</option>
                  <option value="CurrentDay">Current Day</option>
                  <option value="RemainingTrip">Remaining Trip</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Weather</label>
                <select className="w-full border border-gray-300 rounded-lg p-2 text-sm" value={replanWeather} onChange={(e) => setReplanWeather(+e.target.value)}>
                  <option value={0}>Clear</option>
                  <option value={1}>Good</option>
                  <option value={2}>Bad</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowReplan(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 transition">Cancel</button>
              <button onClick={handleReplan} className="px-4 py-2 text-sm rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition">Replan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
