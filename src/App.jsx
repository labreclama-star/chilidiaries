import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import MoreSheetModal from './components/MoreSheetModal.jsx';
import ContestJoinModal from './components/ContestJoinModal.jsx';
import Sidebar from './components/Sidebar.jsx';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import BottomNav from './components/BottomNav.jsx';
import MobileFab from './components/MobileFab.jsx';
import ToastStack from './components/ToastStack.jsx';
import BackButton from './components/BackButton.jsx';

import AuthModal from './components/AuthModal.jsx';
import EditProfileModal from './components/EditProfileModal.jsx';
import CreateDiaryWizard from './components/CreateDiaryWizard.jsx';
import AddVarietyModal from './components/AddVarietyModal.jsx';
import AddRecipeModal from './components/AddRecipeModal.jsx';
import WriteArticleModal from './components/WriteArticleModal.jsx';
import AskQuestionModal from './components/AskQuestionModal.jsx';
import ContestDetailModal from './components/ContestDetailModal.jsx';
import DiaryReportModal from './components/DiaryReportModal.jsx';

import Home from './pages/Home.jsx';
import Feed from './pages/Feed.jsx';
import Diaries from './pages/Diaries.jsx';
import DiaryDetail from './pages/DiaryDetail.jsx';
import Growers from './pages/Growers.jsx';
import GrowerDetail from './pages/GrowerDetail.jsx';
import MyDiaries from './pages/MyDiaries.jsx';
import Varieties from './pages/Varieties.jsx';
import VarietyDetail from './pages/VarietyDetail.jsx';
import Lights from './pages/Lights.jsx';
import Nutrients from './pages/Nutrients.jsx';
import Contests from './pages/Contests.jsx';
import Leaderboard from './pages/Leaderboard.jsx';
import Recipes from './pages/Recipes.jsx';
import RecipeDetail from './pages/RecipeDetail.jsx';
import Questions from './pages/Questions.jsx';
import QuestionDetail from './pages/QuestionDetail.jsx';
import Blog from './pages/Blog.jsx';
import BlogDetail from './pages/BlogDetail.jsx';
import HowItWorks from './pages/HowItWorks.jsx';
import NotFound from './pages/NotFound.jsx';

import ProtectedAdminRoute from './admin/ProtectedAdminRoute.jsx';
import AdminLayout from './admin/AdminLayout.jsx';
import AdminDashboard from './admin/pages/AdminDashboard.jsx';
import AdminVarieties from './admin/pages/AdminVarieties.jsx';
import AdminDiaries from './admin/pages/AdminDiaries.jsx';
import AdminUsers from './admin/pages/AdminUsers.jsx';
import AdminRecipes from './admin/pages/AdminRecipes.jsx';
import AdminBlog from './admin/pages/AdminBlog.jsx';
import AdminQuestions from './admin/pages/AdminQuestions.jsx';
import AdminContests from './admin/pages/AdminContests.jsx';
import AdminLights from './admin/pages/AdminLights.jsx';
import AdminNutrients from './admin/pages/AdminNutrients.jsx';
import AdminSettings from './admin/pages/AdminSettings.jsx';
import AdminData from './admin/pages/AdminData.jsx';

import { useApp } from './context/AppContext.jsx';

// Сбрасываем скролл в самый верх при смене маршрута (иначе после клика по карточке
// детальная страница открывается на той же прокрутке, что была в списке).
// Зависим только от pathname: смена query (?tag=…) или hash (#report-day-…) не должна
// сбрасывать скролл. behavior:'instant' обязателен — в index.css у html стоит
// scroll-behavior:smooth, и обычный scrollTo(0, 0) плавно «уезжал» бы вверх с анимацией.
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
}

export default function App() {
  const { loading } = useApp();
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');

  if (loading) {
    // Data "fetch" (mock today, real Supabase call tomorrow) is in flight.
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cream-dim)' }}>
        Загрузка ChiliDiaries…
      </div>
    );
  }

  // На /admin/* публичный шелл (Sidebar/Header/BottomNav/MobileFab/Footer/BackButton)
  // не рендерится вообще — у админки свой AdminLayout с собственной шапкой и меню.
  // Модалки и ToastStack остаются смонтированными всегда: ToastStack нужен и в
  // админке (тосты CRUD-операций), а AuthModal — для случая захода на /admin без логина.
  return (
    <>
      {!isAdminRoute && <Sidebar />}
      {!isAdminRoute && <BottomNav />}
      {!isAdminRoute && <MobileFab />}
      {!isAdminRoute && <Header />}

      <div className={isAdminRoute ? undefined : 'app-main'} id={isAdminRoute ? undefined : 'appMain'}>
        <main>
          {!isAdminRoute && <BackButton />}
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/feed" element={<Feed />} />
            <Route path="/diaries" element={<Diaries />} />
            <Route path="/diaries/:id" element={<DiaryDetail />} />
            <Route path="/growers" element={<Growers />} />
            <Route path="/growers/:id" element={<GrowerDetail />} />
            <Route path="/my-diaries" element={<MyDiaries />} />
            <Route path="/varieties" element={<Varieties />} />
            <Route path="/varieties/:id" element={<VarietyDetail />} />
            <Route path="/lights" element={<Lights />} />
            <Route path="/nutrients" element={<Nutrients />} />
            <Route path="/contests" element={<Contests />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/recipes" element={<Recipes />} />
            <Route path="/recipes/:id" element={<RecipeDetail />} />
            <Route path="/questions" element={<Questions />} />
            <Route path="/questions/:id" element={<QuestionDetail />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:id" element={<BlogDetail />} />
            <Route path="/how" element={<HowItWorks />} />

            <Route path="/admin" element={<ProtectedAdminRoute><AdminLayout /></ProtectedAdminRoute>}>
              <Route index element={<AdminDashboard />} />
              <Route path="varieties" element={<AdminVarieties />} />
              <Route path="diaries" element={<AdminDiaries />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="recipes" element={<AdminRecipes />} />
              <Route path="blog" element={<AdminBlog />} />
              <Route path="questions" element={<AdminQuestions />} />
              <Route path="contests" element={<AdminContests />} />
              <Route path="lights" element={<AdminLights />} />
              <Route path="nutrients" element={<AdminNutrients />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="data" element={<AdminData />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        {!isAdminRoute && <Footer />}
      </div>

      {/* All modals stay mounted always (matches the original single-overlay-per-id
          pattern) so their internal form state survives being hidden — this is what
          lets "add your own variety" opened from inside the diary wizard return to
          the wizard without losing progress. */}
<AuthModal />
<EditProfileModal />
<CreateDiaryWizard />
<AddVarietyModal />
<AddRecipeModal />
<WriteArticleModal />
<AskQuestionModal />
<MoreSheetModal />
<ContestDetailModal />
<ContestJoinModal />
<DiaryReportModal />

<ToastStack />
    </>
  );
}
