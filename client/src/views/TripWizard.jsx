import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { searchPlaces, createTrip, updateTrip, generateItinerary, getTripDetails, getCityInterests } from "../api";

const PRIORITIES = [
  { label: "High", value: 0 },
  { label: "Medium", value: 1 },
  { label: "Low", value: 2 },
];
const STRATEGIES = [
  { value: 0, label: "Always (return to hotel each block)" },
  { value: 1, label: "Never (continuous flow)" },
  { value: 2, label: "Proximity Based" },
];

export default function TripWizard() {
  const navigate = useNavigate();
  const { tripId } = useParams();
  const isEdit = !!tripId;
  const [step, setStep] = useState(isEdit ? "created" : "form");
  const [createdTrip, setCreatedTrip] = useState(null);
  const [genError, setGenError] = useState(null);

  const [cityCode, setCityCode] = useState("madrid");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [hotelName, setHotelName] = useState("");
  const [hotelLat, setHotelLat] = useState("");
  const [hotelLng, setHotelLng] = useState("");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [carAvailable, setCarAvailable] = useState(false);
  const [maxWalking, setMaxWalking] = useState(30);
  const [weatherAware, setWeatherAware] = useState(true);
  const [returnStrategy, setReturnStrategy] = useState(0);

  const [availableInterests, setAvailableInterests] = useState([]);
  const [selectedInterests, setSelectedInterests] = useState([]);

  useEffect(() => {
    if (!cityCode.trim()) return;
    getCityInterests(cityCode.trim())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setAvailableInterests(list);
        setSelectedInterests([]);
      })
      .catch(() => setAvailableInterests([]));
  }, [cityCode]);

  useEffect(() => {
    if (!isEdit || !tripId) return;
    getTripDetails(tripId).then((trip) => {
      if (!trip) return;
      setCreatedTrip(trip);
      setCityCode(trip.cityCode || "madrid");
      setStartDate(trip.startDate || "");
      setEndDate(trip.endDate || "");
      setHotelName(trip.baseHotel?.name || "");
      setHotelLat(trip.baseHotel?.latitude != null ? String(trip.baseHotel.latitude) : "");
      setHotelLng(trip.baseHotel?.longitude != null ? String(trip.baseHotel.longitude) : "");
      setAdults(trip.travelers?.adults ?? 2);
      setChildren(trip.travelers?.children ?? 0);
      setInfants(trip.travelers?.infants ?? 0);
      setCarAvailable(trip.preferences?.carAvailable ?? false);
      setMaxWalking(trip.preferences?.maxWalkingMinutes ?? 30);
      setWeatherAware(trip.preferences?.weatherAwareEnabled ?? true);
      setReturnStrategy(trip.preferences?.returnToHotelStrategy ?? 0);
      setSelectedInterests(trip.preferences?.interests || []);
      const ms = (trip.mustSees || []).map((m) => ({ placeId: m.placeId, priority: m.priority, name: m.placeName || "" }));
      setBasket(ms);
      setOriginalMustSeeIds(ms.map((m) => m.placeId).filter((id) => id != null));
    }).catch(() => {});
  }, [tripId]);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [basket, setBasket] = useState([]);

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [originalMustSeeIds, setOriginalMustSeeIds] = useState([]);

  function handleSearch() {
    if (!searchQuery.trim() || searchQuery.length < 3) return;
    setSearching(true);
    searchPlaces(searchQuery.trim(), cityCode)
      .then((data) => setSearchResults(Array.isArray(data) ? data : []))
      .catch((err) => alert("Search failed: " + err.message))
      .finally(() => setSearching(false));
  }

  function addToBasket(place) {
    if (basket.some((b) => b.placeId === place.placeId || (b.providerReferenceId && b.providerReferenceId === place.providerReferenceId))) return;
    setBasket([...basket, { ...place, priority: 1 }]);
  }

  function removeFromBasket(idx) {
    setBasket(basket.filter((_, i) => i !== idx));
  }

  function setPriority(idx, p) {
    const copy = [...basket];
    copy[idx] = { ...copy[idx], priority: p };
    setBasket(copy);
  }

  function buildPayload() {
    return {
      cityCode,
      startDate,
      endDate,
      baseHotel: {
        name: hotelName,
        latitude: parseFloat(hotelLat),
        longitude: parseFloat(hotelLng),
      },
      travelers: { adults, children, infants },
      preferences: {
        carAvailable,
        maxWalkingMinutes: maxWalking,
        weatherAwareEnabled: weatherAware,
        returnToHotelStrategy: returnStrategy,
        interests: selectedInterests,
      },
      mustSees: basket.map((b) => ({
        placeId: b.placeId,
        priority: b.priority,
      })).filter((m) => m.placeId != null && m.placeId > 0),
    };
  }

  async function handleCreate() {
    if (!cityCode || !startDate || !endDate || !hotelName || !hotelLat || !hotelLng) {
      alert("Please fill in all required fields (city, dates, hotel).");
      return;
    }
    const payload = buildPayload();
    if (payload.mustSees.length === 0) {
      alert("Add at least one must-see to the basket before creating the trip.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const trip = await createTrip(payload);
      setCreatedTrip(trip);
      setOriginalMustSeeIds(basket.map((b) => b.placeId).filter((id) => id != null));
      setStep("created");
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveChanges() {
    if (!createdTrip) return;
    const currentIds = basket.map((b) => b.placeId).filter((id) => id != null);
    const mustSeesToAdd = basket
      .filter((b) => b.placeId != null && !originalMustSeeIds.includes(b.placeId))
      .map((b) => ({ placeId: b.placeId, priority: b.priority }));
    const mustSeesToRemove = originalMustSeeIds.filter((id) => !currentIds.includes(id));
    const patch = {
      startDate,
      endDate,
      baseHotel: { name: hotelName, latitude: parseFloat(hotelLat), longitude: parseFloat(hotelLng) },
      travelers: { adults, children, infants },
      preferences: {
        carAvailable,
        maxWalkingMinutes: maxWalking,
        weatherAwareEnabled: weatherAware,
        returnToHotelStrategy: returnStrategy,
        interests: selectedInterests,
      },
    };
    if (mustSeesToAdd.length) patch.mustSeesToAdd = mustSeesToAdd;
    if (mustSeesToRemove.length) patch.mustSeesToRemove = mustSeesToRemove;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await updateTrip(createdTrip.tripId, patch);
      setCreatedTrip(updated);
      setOriginalMustSeeIds(currentIds);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerate() {
    if (!createdTrip) return;
    setStep("generating");
    setGenError(null);
    try {
      await generateItinerary(createdTrip.tripId);
      navigate(`/trips/${createdTrip.tripId}`, { replace: true });
    } catch (err) {
      setGenError(err.message);
      setStep("created");
    }
  }

  if (step === "created" || step === "generating") {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <button onClick={() => navigate("/trips")} className="text-sm text-gray-500 hover:text-indigo-600 transition">&larr; Dashboard</button>
            <h1 className="text-xl font-bold mt-1">{createdTrip?.tripCode || "Edit Trip"} <span className="text-sm font-normal text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{createdTrip?.status}</span></h1>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSaveChanges} disabled={saving || step === "generating"} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition">{saving ? "Saving..." : "Save Changes"}</button>
            <button onClick={handleGenerate} disabled={step === "generating"} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition">{step === "generating" ? "Generating..." : "Generate Itinerary"}</button>
          </div>
        </div>
        {genError && <p className="text-red-500 text-sm mb-4">{genError}</p>}
        {saveError && <p className="text-red-500 text-sm mb-4">{saveError}</p>}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-5">
            <fieldset className="bg-white rounded-xl border border-gray-200 p-5">
              <legend className="font-semibold px-2 text-sm text-gray-700">Destination & Dates</legend>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">City Code</label>
                  <input className="w-full border border-gray-300 rounded-lg p-2 text-sm bg-gray-50" value={cityCode} disabled />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-600 mb-1">Start</label>
                    <input type="date" className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-600 mb-1">End</label>
                    <input type="date" className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                </div>
              </div>
            </fieldset>

            <fieldset className="bg-white rounded-xl border border-gray-200 p-5">
              <legend className="font-semibold px-2 text-sm text-gray-700">Base Hotel</legend>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Name</label>
                  <input className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none" value={hotelName} onChange={(e) => setHotelName(e.target.value)} />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-600 mb-1">Latitude</label>
                    <input type="number" step="any" className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none" value={hotelLat} onChange={(e) => setHotelLat(e.target.value)} />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-600 mb-1">Longitude</label>
                    <input type="number" step="any" className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none" value={hotelLng} onChange={(e) => setHotelLng(e.target.value)} />
                  </div>
                </div>
              </div>
            </fieldset>

            <fieldset className="bg-white rounded-xl border border-gray-200 p-5">
              <legend className="font-semibold px-2 text-sm text-gray-700">Travelers</legend>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-600 mb-1">Adults</label>
                  <input type="number" min={1} className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none" value={adults} onChange={(e) => setAdults(+e.target.value)} />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-600 mb-1">Children</label>
                  <input type="number" min={0} className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none" value={children} onChange={(e) => setChildren(+e.target.value)} />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-600 mb-1">Infants</label>
                  <input type="number" min={0} className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none" value={infants} onChange={(e) => setInfants(+e.target.value)} />
                </div>
              </div>
            </fieldset>

            <fieldset className="bg-white rounded-xl border border-gray-200 p-5">
              <legend className="font-semibold px-2 text-sm text-gray-700">Preferences</legend>
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={carAvailable} onChange={(e) => setCarAvailable(e.target.checked)} className="rounded" />
                  Car available
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={weatherAware} onChange={(e) => setWeatherAware(e.target.checked)} className="rounded" />
                  Weather-aware scheduling
                </label>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Interests</label>
                  <div className="flex flex-wrap gap-1.5">
                    {availableInterests.map((interest) => {
                      const active = selectedInterests.includes(interest);
                      return (
                        <button key={interest} type="button" onClick={() => setSelectedInterests((prev) => active ? prev.filter((i) => i !== interest) : [...prev, interest])}
                          className={`text-xs px-2.5 py-1 rounded-full border transition ${active ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"}`}>
                          {interest}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Max walking (min)</label>
                  <input type="number" min={5} max={120} className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none" value={maxWalking} onChange={(e) => setMaxWalking(+e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Return to hotel strategy</label>
                  <select className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none" value={returnStrategy} onChange={(e) => setReturnStrategy(+e.target.value)}>
                    {STRATEGIES.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
                  </select>
                </div>
              </div>
            </fieldset>
          </div>

          <div className="space-y-5">
            <fieldset className="bg-white rounded-xl border border-gray-200 p-5">
              <legend className="font-semibold px-2 text-sm text-gray-700">Search Places (Must-Sees)</legend>
              <div className="flex gap-2 mb-3">
                <input className="flex-1 border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none" placeholder="Search query (min 3 chars)..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} />
                <button onClick={handleSearch} disabled={searchQuery.length < 3 || searching} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 transition">{searching ? "..." : "Search"}</button>
              </div>
              {searchResults.length > 0 && (
                <div className="max-h-48 overflow-y-auto space-y-2 border border-gray-100 rounded-lg p-2">
                  {searchResults.map((p, i) => (
                    <div key={p.placeId || p.providerReferenceId || i} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg p-2">
                      <div>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-gray-400">{p.isIndoor ? "Indoor" : "Outdoor"} &middot; ~{p.typicalDurationMinutes}min</p>
                      </div>
                      <button onClick={() => addToBasket(p)} disabled={basket.some((b) => b.placeId === p.placeId)} className="text-indigo-600 hover:text-indigo-800 text-xs font-medium disabled:text-gray-300 transition">+ Add</button>
                    </div>
                  ))}
                </div>
              )}
            </fieldset>

            <fieldset className="bg-white rounded-xl border border-gray-200 p-5">
              <legend className="font-semibold px-2 text-sm text-gray-700">Must-Sees ({basket.length})</legend>
              {basket.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">No must-sees added yet</p>}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {basket.map((b, i) => (
                  <div key={i} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg p-2">
                    <span className="text-xs text-gray-400 mr-1">#{b.placeId}</span>
                    <span className="font-medium truncate flex-1">{b.name || `Place ${b.placeId}`}</span>
                    <span className="text-xs text-gray-400 mr-2">{originalMustSeeIds.includes(b.placeId) ? "" : "new"}</span>
                    <select className="text-xs border border-gray-300 rounded mx-1 p-1" value={b.priority} onChange={(e) => setPriority(i, +e.target.value)}>
                      {PRIORITIES.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
                    </select>
                    <button onClick={() => removeFromBasket(i)} className="text-red-500 hover:text-red-700 text-xs font-medium ml-1">&times;</button>
                  </div>
                ))}
              </div>
            </fieldset>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <button onClick={() => navigate("/trips")} className="text-sm text-gray-500 hover:text-indigo-600 mb-4 transition">&larr; Back</button>
      <h1 className="text-2xl font-bold mb-6">Create New Trip</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* LEFT COL — Trip details */}
        <div className="space-y-5">
          <fieldset className="bg-white rounded-xl border border-gray-200 p-5">
            <legend className="font-semibold px-2 text-sm text-gray-700">Destination & Dates</legend>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">City Code</label>
                <input className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none" value={cityCode} onChange={(e) => setCityCode(e.target.value)} placeholder="e.g. madrid" />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-600 mb-1">Start</label>
                  <input type="date" className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-600 mb-1">End</label>
                  <input type="date" className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>
            </div>
          </fieldset>

          <fieldset className="bg-white rounded-xl border border-gray-200 p-5">
            <legend className="font-semibold px-2 text-sm text-gray-700">Base Hotel</legend>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Name</label>
                <input className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none" value={hotelName} onChange={(e) => setHotelName(e.target.value)} placeholder="e.g. Hotel RIU Plaza España" />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-600 mb-1">Latitude</label>
                  <input type="number" step="any" className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none" value={hotelLat} onChange={(e) => setHotelLat(e.target.value)} placeholder="40.4241" />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-600 mb-1">Longitude</label>
                  <input type="number" step="any" className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none" value={hotelLng} onChange={(e) => setHotelLng(e.target.value)} placeholder="-3.7109" />
                </div>
              </div>
            </div>
          </fieldset>

          <fieldset className="bg-white rounded-xl border border-gray-200 p-5">
            <legend className="font-semibold px-2 text-sm text-gray-700">Travelers</legend>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-600 mb-1">Adults</label>
                <input type="number" min={1} className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none" value={adults} onChange={(e) => setAdults(+e.target.value)} />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-600 mb-1">Children</label>
                <input type="number" min={0} className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none" value={children} onChange={(e) => setChildren(+e.target.value)} />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-600 mb-1">Infants</label>
                <input type="number" min={0} className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none" value={infants} onChange={(e) => setInfants(+e.target.value)} />
              </div>
            </div>
          </fieldset>

          <fieldset className="bg-white rounded-xl border border-gray-200 p-5">
            <legend className="font-semibold px-2 text-sm text-gray-700">Preferences</legend>
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={carAvailable} onChange={(e) => setCarAvailable(e.target.checked)} className="rounded" />
                Car available
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={weatherAware} onChange={(e) => setWeatherAware(e.target.checked)} className="rounded" />
                Weather-aware scheduling
              </label>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Interests</label>
                {availableInterests.length === 0 && <p className="text-xs text-gray-400">No interests loaded for this city</p>}
                <div className="flex flex-wrap gap-1.5">
                  {availableInterests.map((interest) => {
                    const active = selectedInterests.includes(interest);
                    return (
                      <button
                        key={interest}
                        type="button"
                        onClick={() => setSelectedInterests((prev) => active ? prev.filter((i) => i !== interest) : [...prev, interest])}
                        className={`text-xs px-2.5 py-1 rounded-full border transition ${active ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"}`}
                      >
                        {interest}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Max walking (min)</label>
                <input type="number" min={5} max={120} className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none" value={maxWalking} onChange={(e) => setMaxWalking(+e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Return to hotel strategy</label>
                <select className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none" value={returnStrategy} onChange={(e) => setReturnStrategy(+e.target.value)}>
                  {STRATEGIES.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
                </select>
              </div>
            </div>
          </fieldset>
        </div>

        {/* RIGHT COL — Search + Basket */}
        <div className="space-y-5">
          <fieldset className="bg-white rounded-xl border border-gray-200 p-5">
            <legend className="font-semibold px-2 text-sm text-gray-700">Search Places (Must-Sees)</legend>
            <div className="flex gap-2 mb-3">
              <input
                className="flex-1 border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                placeholder="Search query (min 3 chars)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <button onClick={handleSearch} disabled={searchQuery.length < 3 || searching} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 transition">
                {searching ? "..." : "Search"}
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="max-h-64 overflow-y-auto space-y-2 border border-gray-100 rounded-lg p-2">
                {searchResults.map((p, i) => (
                  <div key={p.placeId || p.providerReferenceId || i} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg p-2">
                    <div>
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-gray-400">{p.isIndoor ? "Indoor" : "Outdoor"} &middot; ~{p.typicalDurationMinutes}min</p>
                    </div>
                    <button onClick={() => addToBasket(p)} disabled={basket.some((b) => b.placeId === p.placeId || (b.providerReferenceId === p.providerReferenceId))} className="text-indigo-600 hover:text-indigo-800 text-xs font-medium disabled:text-gray-300 transition">
                      + Add
                    </button>
                  </div>
                ))}
              </div>
            )}
            {!searching && searchQuery.length >= 3 && searchResults.length === 0 && (
              <p className="text-sm text-gray-400">No results found.</p>
            )}
          </fieldset>

          <fieldset className="bg-white rounded-xl border border-gray-200 p-5">
            <legend className="font-semibold px-2 text-sm text-gray-700">Basket ({basket.length})</legend>
            {basket.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">No must-sees added yet</p>}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {basket.map((b, i) => (
                <div key={i} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg p-2">
                  <span className="font-medium truncate flex-1">{b.name}</span>
                  <select className="text-xs border border-gray-300 rounded mx-2 p-1" value={b.priority} onChange={(e) => setPriority(i, +e.target.value)}>
                    {PRIORITIES.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
                  </select>
                  <button onClick={() => removeFromBasket(i)} className="text-red-500 hover:text-red-700 text-xs font-medium">&times;</button>
                </div>
              ))}
            </div>
          </fieldset>

          {createError && <p className="text-red-500 text-sm">{createError}</p>}
          <button
            onClick={handleCreate}
            disabled={creating}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {creating ? "Creating..." : "Create Trip"}
          </button>
        </div>
      </div>
    </div>
  );
}
