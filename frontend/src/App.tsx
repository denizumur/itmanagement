import { Route, Routes } from "react-router";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { AssetsPage } from "./pages/AssetsPage";
import { AssignmentsPage } from "./pages/AssignmentsPage";
import { LoginPage } from "./pages/LoginPage";
import { OverviewPage } from "./pages/OverviewPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { WorkspacePage } from "./pages/WorkspacePage";
import { MaintenancePage } from "./pages/MaintenancePage";
import { LicensesPage } from "./pages/LicensesPage";
import { RemindersPage } from "./pages/RemindersPage";
import { MyTicketsPage } from "./pages/MyTicketsPage";
import { ApprovalsPage } from "./pages/ApprovalsPage";

const operationalRoles = ["admin", "technician", "viewer"] as const;
const requesterRoles = ["requester"] as const;
const approverRoles = ["approver"] as const;

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <ProtectedRoute
            allowedRoles={[...operationalRoles]}
            fallbackPath="/login"
          />
        }
      >
        <Route path="/" element={<OverviewPage />} />
        <Route path="/workspace" element={<WorkspacePage />} />
        <Route path="/assets" element={<AssetsPage />} />
        <Route path="/assignments" element={<AssignmentsPage />} />
        <Route path="/licenses" element={<LicensesPage />} />
        <Route path="/maintenance" element={<MaintenancePage />} />
        <Route path="/reminders" element={<RemindersPage />} />
      </Route>

      <Route
        element={
          <ProtectedRoute
            allowedRoles={[...requesterRoles]}
            fallbackPath="/my-tickets"
          />
        }
      >
        <Route path="/my-tickets" element={<MyTicketsPage />} />
      </Route>

      <Route
        element={
          <ProtectedRoute
            allowedRoles={[...approverRoles]}
            fallbackPath="/approvals"
          />
        }
      >
        <Route path="/approvals" element={<ApprovalsPage />} />
      </Route>

      <Route
        path="*"
        element={
          <PlaceholderPage
            title="Sayfa bulunamadı"
            description="Aradığın route henüz tanımlı değil veya yanlış bir bağlantıya gidildi."
          />
        }
      />
    </Routes>
  );
}