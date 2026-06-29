import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import LoginMock from "./views/LoginMock";
import TripDashboard from "./views/TripDashboard";
import TripWizard from "./views/TripWizard";
import TripDetailsView from "./views/TripDetailsView";

function Protected({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function Guest({ children }) {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/trips" replace />;
  return children;
}

export default function App() {
  return (
    <div className="min-h-screen">
      <Routes>
        <Route path="/login" element={<Guest><LoginMock /></Guest>} />
        <Route path="/trips" element={<Protected><TripDashboard /></Protected>} />
        <Route path="/trips/new" element={<Protected><TripWizard /></Protected>} />
        <Route path="/trips/:tripId" element={<Protected><TripDetailsView /></Protected>} />
        <Route path="/trips/:tripId/edit" element={<Protected><TripWizard /></Protected>} />
        <Route path="*" element={<Navigate to="/trips" replace />} />
      </Routes>
    </div>
  );
}
