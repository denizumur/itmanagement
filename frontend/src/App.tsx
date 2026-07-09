import { Route, Routes } from "react-router";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { OverviewPage } from "./pages/OverviewPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { WorkspacePage } from "./pages/WorkspacePage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/workspace" element={<WorkspacePage />} />

        <Route
          path="/assets"
          element={
            <PlaceholderPage
              title="Envanter"
              description="Varlık listesi, kategori filtreleri, detay ekranı ve Excel import akışı burada geliştirilecek."
            />
          }
        />

        <Route
          path="/assignments"
          element={
            <PlaceholderPage
              title="Zimmet"
              description="Personel bazlı zimmet listesi, aktif zimmetler ve iade işlemleri burada geliştirilecek."
            />
          }
        />

        <Route
          path="/licenses"
          element={
            <PlaceholderPage
              title="Lisanslar"
              description="Lisans ve abonelik listesi, yaklaşan bitişler, yenileme maliyetleri ve detay ekranları burada geliştirilecek."
            />
          }
        />

        <Route
          path="/maintenance"
          element={
            <PlaceholderPage
              title="Bakım"
              description="Bakım takvimi, onarım kayıtları, gecikmiş bakım listesi ve imha geçmişi burada geliştirilecek."
            />
          }
        />

        <Route
          path="/reminders"
          element={
            <PlaceholderPage
              title="Hatırlatıcılar"
              description="Garanti, bakım ve lisans kaynaklı görünür hatırlatıcılar burada listelenecek."
            />
          }
        />

        <Route
          path="*"
          element={
            <PlaceholderPage
              title="Sayfa bulunamadı"
              description="Aradığın route henüz tanımlı değil veya yanlış bir bağlantıya gidildi."
            />
          }
        />
      </Route>
    </Routes>
  );
}