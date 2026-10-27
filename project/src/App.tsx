import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ScrollToTop from '@/components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import Home from '@/pages/Home';
import DiseaseDetection from '@/pages/DiseaseDetection';
import FarmPlanner from '@/pages/FarmPlanner';
import Chatbot from '@/pages/Chatbot';
import VarietySuitability from '@/pages/VarietySuitability';
import WeatherDiseasePrediction from '@/pages/WeatherDiseasePrediction';
import Login from '@/pages/Login';
import SignUp from '@/pages/SignUp';
import MarketplaceHome from '@/pages/marketplace/MarketplaceHome';
import ProductDetail from '@/pages/marketplace/ProductDetail';
import NearbyShops from '@/pages/marketplace/NearbyShops';
import Cart from '@/pages/marketplace/Cart';
import OrderHistory from '@/pages/marketplace/OrderHistory';
import AdminMarketplace from '@/pages/marketplace/AdminMarketplace';
import NotFound from '@/pages/NotFound';
import ErrorBoundary from '@/components/ErrorBoundary';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ScrollToTop />
        <div className="flex min-h-screen flex-col bg-white text-forest-900">
          <Navbar />
          <main className="flex-1 flex flex-col">
            <ErrorBoundary>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<SignUp />} />
                <Route path="/disease-detection" element={<DiseaseDetection />} />
                <Route path="/marketplace" element={<MarketplaceHome />} />
                <Route path="/marketplace/product/:id" element={<ProductDetail />} />
                <Route path="/marketplace/shops" element={<NearbyShops />} />
                <Route
                  path="/marketplace/cart"
                  element={
                    <ProtectedRoute>
                      <Cart />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/marketplace/orders"
                  element={
                    <ProtectedRoute>
                      <OrderHistory />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/marketplace/admin"
                  element={
                    <ProtectedRoute>
                      <AdminMarketplace />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/farm-planner"
                  element={
                    <ProtectedRoute>
                      <FarmPlanner />
                    </ProtectedRoute>
                  }
                />
                <Route path="/chatbot" element={<Chatbot />} />
                <Route path="/variety-suitability" element={<VarietySuitability />} />
                <Route path="/weather-disease-prediction" element={<WeatherDiseasePrediction />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </ErrorBoundary>
          </main>
          <Footer />
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
