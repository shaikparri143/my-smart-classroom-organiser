import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const StudentDashboard = lazy(() => import("./pages/student/StudentDashboard"));
const TeacherDashboard = lazy(() => import("./pages/teacher/TeacherDashboard"));
import { NotificationProvider } from "./context/NotificationContext";
import {
  NotificationBell,
} from "./components/notifications/NotificationCenter";









import LandingPage from "./pages/auth/LandingPage";

import LoginPage from "./pages/auth/LoginPage";

import RegisterPage from "./pages/auth/RegisterPage";

import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
const AIAssistantPage = lazy(() => import("./pages/teacher/AIAssistantPage"));
import { ThemeSwitch, ToastProvider } from "./components/common/DesignSystem";
import SettingsPage from "./pages/SettingsPage";

import { getCurrentUser, hasToken, logout } from "./services/auth";







import {

  LayoutDashboard, BookOpen, CalendarDays, ClipboardCheck,

  Users, GraduationCap, ChartNoAxesCombined, MessageSquare,

  Bell, Settings, Search, Plus, ArrowUpRight,

  ChevronDown, Sparkles, FileText, Menu, X, BrainCircuit

} from 'lucide-react';



const teacherNavigation = [
  { section: 'WORKSPACE', items: [
    { label: 'Overview', icon: LayoutDashboard },
    { label: 'My Courses', icon: BookOpen },
    { label: 'Calendar', icon: CalendarDays },
    { label: 'Attendance', icon: ClipboardCheck },
    { label: 'Assignments', icon: FileText },
    { label: 'Announcements', icon: MessageSquare },
    { label: 'Discussions', icon: MessageSquare },
  ]},
  { section: 'ACADEMIC', items: [
    { label: 'Students', icon: Users },
    { label: 'Gradebook', icon: GraduationCap },
    { label: 'Analytics', icon: ChartNoAxesCombined },
  ]},
  { section: 'COMMUNICATION', items: [
    { label: 'Doubt Box', icon: MessageSquare },
    { label: 'Notifications', icon: Bell },
    { label: 'AI Assistant', icon: BrainCircuit },
    { label: 'Settings', icon: Settings },
  ]},
];

const studentNavigation = [
  { section: 'LEARNING', items: [
    { label: 'Overview', icon: LayoutDashboard },
    { label: 'My Courses', icon: BookOpen },
    { label: 'Calendar', icon: CalendarDays },
    { label: 'Assignments', icon: FileText },
    { label: 'My Attendance', icon: ClipboardCheck },
    { label: 'My Grades', icon: GraduationCap },
    { label: 'Announcements', icon: MessageSquare },
    { label: 'Discussions', icon: MessageSquare },
  ]},
  { section: 'SUPPORT', items: [
    { label: 'Doubt Box', icon: MessageSquare },
    { label: 'Notifications', icon: Bell },
    { label: 'AI Assistant', icon: BrainCircuit },
    { label: 'Settings', icon: Settings },
  ]},
];



function App() {

  const [activePage, setActivePage] = useState('Overview');
  const [pageTransitioning, setPageTransitioning] = useState(false);
  const pageContentRef = useRef(null);
  const pageTransitionLockRef = useRef(false);
  const pageAnimationRef = useRef(null);
  const pageTransitionTimerRef = useRef(null);
  const previousPageRef = useRef(activePage);

  const [mobileMenu, setMobileMenu] = useState(false);

  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef(null);





  const [authUser, setAuthUser] = useState(null);

const [authPage, setAuthPage] = useState("landing");

const [authLoading, setAuthLoading] = useState(true);

const [authError, setAuthError] = useState("");

  const isTeacher = authUser?.role === 'teacher';
  const navigation = isTeacher ? teacherNavigation : studentNavigation;
  const displayName = authUser?.full_name?.trim()?.split(/\s+/)[0] || 'there';

const navigateTo = useCallback((nextPage, { recordHistory = true } = {}) => {
  setMobileMenu(false);
  if (!nextPage || nextPage === activePage || pageTransitionLockRef.current) return;
  if (recordHistory) {
    window.history.pushState(
      { ...window.history.state, classpilotPage: nextPage },
      "",
      window.location.href,
    );
  }
  const reducedMotion =
    document.documentElement.dataset.reducedMotion === "true"
    || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const content = pageContentRef.current;
  if (reducedMotion || typeof content?.animate !== "function") {
    setActivePage(nextPage);
    return;
  }

  pageTransitionLockRef.current = true;
  setPageTransitioning(true);
  pageAnimationRef.current?.cancel();
  pageAnimationRef.current = content.animate(
    [
      { opacity: 1, transform: "translateY(0) scale(1)" },
      { opacity: 0, transform: "translateY(8px) scale(.975)" },
    ],
    { duration: 170, easing: "cubic-bezier(.4, 0, .8, .4)", fill: "forwards" },
  );
  pageTransitionTimerRef.current = window.setTimeout(() => setActivePage(nextPage), 450);
  pageAnimationRef.current.onfinish = () => {
    window.clearTimeout(pageTransitionTimerRef.current);
    setActivePage(nextPage);
  };
}, [activePage]);

useLayoutEffect(() => {
  if (previousPageRef.current === activePage) return undefined;
  previousPageRef.current = activePage;

  const content = pageContentRef.current;
  const reducedMotion =
    document.documentElement.dataset.reducedMotion === "true"
    || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!pageTransitionLockRef.current || reducedMotion || typeof content?.animate !== "function") {
    pageTransitionLockRef.current = false;
    setPageTransitioning(false);
    return undefined;
  }

  pageAnimationRef.current = content.animate(
    [
      { opacity: 0, transform: "translateY(9px) scale(.975)" },
      { opacity: 1, transform: "translateY(0) scale(1)" },
    ],
    { duration: 225, easing: "cubic-bezier(.18, .72, .24, 1)", fill: "both" },
  );
  pageTransitionTimerRef.current = window.setTimeout(() => {
    pageTransitionLockRef.current = false;
    setPageTransitioning(false);
    pageAnimationRef.current = null;
  }, 235);

  return () => window.clearTimeout(pageTransitionTimerRef.current);
}, [activePage]);

useEffect(() => () => {
  window.clearTimeout(pageTransitionTimerRef.current);
  pageAnimationRef.current?.cancel();
}, []);

useEffect(() => {
  const allowedPages = new Set([
    ...studentNavigation.flatMap((group) => group.items.map((item) => item.label)),
    ...teacherNavigation.flatMap((group) => group.items.map((item) => item.label)),
  ]);
  const handlePopState = (event) => {
    const page = allowedPages.has(event.state?.classpilotPage)
      ? event.state.classpilotPage
      : "Overview";
    if (page === activePage) return;

    window.clearTimeout(pageTransitionTimerRef.current);
    pageAnimationRef.current?.cancel();
    pageAnimationRef.current = null;
    pageTransitionLockRef.current = false;
    setPageTransitioning(false);
    navigateTo(page, { recordHistory: false });
  };

  if (!allowedPages.has(window.history.state?.classpilotPage)) {
    window.history.replaceState(
      { ...window.history.state, classpilotPage: activePage },
      "",
      window.location.href,
    );
  }
  window.addEventListener("popstate", handlePopState);
  return () => window.removeEventListener("popstate", handlePopState);
}, [activePage, navigateTo]);

useEffect(() => {
  function focusSearch(event) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      setSearchOpen(true);
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }
  }
  window.addEventListener("keydown", focusSearch);
  return () => window.removeEventListener("keydown", focusSearch);
}, []);

function navigateFromSearch(event) {
  if (event.key === "Escape") {
    setSearchOpen(false);
    searchInputRef.current?.blur();
    return;
  }
  if (event.key !== "Enter" || !search.trim()) return;
  const term = search.trim().toLowerCase();
  const items = navigation.flatMap((group) => group.items);
  const match = items.find((item) => item.label.toLowerCase() === term)
    || items.find((item) => item.label.toLowerCase().includes(term));
  if (match) {
    navigateTo(match.label);
    setSearch("");
    setSearchOpen(false);
  }
}


useEffect(() => {

  const controller = new AbortController();



  async function restoreSession() {

    if (!hasToken()) {

      setAuthLoading(false);

      return;

    }



    try {

      const user = await getCurrentUser({ signal: controller.signal });



      if (!controller.signal.aborted) {

        setAuthUser(user);

      }

    } catch (error) {

      if (controller.signal.aborted) {

        return;

      }



      if (error.status === 401 || error.status === 403) {

        logout();

      } else {

        setAuthError(

          error.message || "Unable to restore your session. Please try again.",

        );

      }

    } finally {

      if (!controller.signal.aborted) {

        setAuthLoading(false);

      }

    }

  }



  restoreSession();



  return () => {

    controller.abort();

  };

}, []);

useEffect(() => {
  const handleSessionExpired = () => {
    logout();
    setAuthUser(null);
    setAuthPage("login");
    setAuthError("Your session has expired. Please sign in again.");
  };

  window.addEventListener("classpilot:session-expired", handleSessionExpired);
  return () => {
    window.removeEventListener("classpilot:session-expired", handleSessionExpired);
  };
}, []);











  const descriptions = {

    Overview: isTeacher ? "Here's what's happening in your classroom today." : "Here's your learning progress and what needs your attention.",

    'My Courses': isTeacher ? 'Manage your courses, learning materials and students.' : 'Explore your enrolled courses and learning materials.',

    Calendar: 'Keep your teaching schedule organized.',

    Attendance: 'Track classroom attendance and participation.',
    'My Attendance': 'Review your attendance record for your courses.',
    Notifications: 'Review recent classroom updates and reminders.',
    Announcements: 'Create and view course announcements.',
    Discussions: 'Share messages and reply in course discussion threads.',
    'My Grades': 'Review your grades and academic progress.',

    Assignments: 'Manage assignment deadlines and submissions.',

    Students: 'Get an overview of your students and their progress.',

    Gradebook: 'Review and manage student grades.',

    Analytics: 'Explore classroom performance and learning insights.',

    'Doubt Box': 'Help students get their questions answered.',

    'AI Assistant': 'Your teaching companion for planning and learning.',

    Settings: 'Manage your classroom workspace.',

  };



  if (authLoading) {

  return (

    <div className="auth-page">

      <div className="auth-form-layout">

        <p>Loading your ClassPilot workspace...</p>

      </div>

    </div>

  );

}



if (!authUser) {

  const authProps = {

    onNavigate: setAuthPage,

    onAuthenticated: (user) => {

      setAuthUser(user);

      setAuthError("");

      setAuthPage("dashboard");

    },

  };



  if (authPage === "login") {
    return <LoginPage {...authProps} notice={authError} />;
  }



  if (authPage === "register") {

    return <RegisterPage {...authProps} />;

  }



  if (authPage === "forgot") {

    return <ForgotPasswordPage onNavigate={setAuthPage} />;

  }



  return <LandingPage onNavigate={setAuthPage} notice={authError} />;

}







  return (

    <ToastProvider>
    <NotificationProvider>
    <div className="app-shell">

      {mobileMenu && (

        <button className="mobile-overlay" onClick={() => setMobileMenu(false)} aria-label="Close navigation" />

      )}



      <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>

        <div className="brand">

          <div className="brand-logo"><GraduationCap size={24} /></div>

          <div className="brand-title">ClassPilot<span>.</span><small>CLASSROOM MANAGEMENT</small></div>

          <button className="mobile-close icon-button" onClick={() => setMobileMenu(false)}><X size={18} /></button>

        </div>



        <button className="workspace-switch">

          <div className="workspace-avatar">SR</div>

          <div className="workspace-copy"><strong>College</strong><span>{isTeacher ? 'Faculty workspace' : 'Student workspace'}</span></div>

          <ChevronDown size={16} />

        </button>



        <nav className="sidebar-nav">

          {navigation.map(group => (

            <div className="nav-group" key={group.section}>

              <p className="nav-heading">{group.section}</p>

              {group.items.map(item => {

                const Icon = item.icon;

                return (

                  <button

                    key={item.label}

                    className={`nav-item ${activePage === item.label ? 'nav-active' : ''}`}

                    onClick={() => {

                      navigateTo(item.label);

                      setMobileMenu(false);

                    }}

                  >

                    <Icon size={18} strokeWidth={1.8} />

                    <span>{item.label}</span>

                    {item.label === 'Doubt Box' && <span className="nav-indicator" />}

                  </button>

                );

              })}

            </div>

          ))}

        </nav>



        <div className="sidebar-bottom">

          <div className="ai-promo">

            <div className="ai-promo-icon"><Sparkles size={18} /></div>

            <strong>{isTeacher ? 'Teach smarter with AI' : 'Learn smarter with AI'}</strong>

            <p>{isTeacher ? 'Spend less time on admin. Focus more on students.' : 'Get help understanding topics and preparing for class.'}</p>

            <button onClick={() => navigateTo('AI Assistant')}>Explore AI tools <ArrowUpRight size={14} /></button>

          </div>

          <div className="account-row">

  <div className="account-avatar">

    {authUser.full_name

      .split(" ")

      .map((part) => part[0])

      .slice(0, 2)

      .join("")

      .toUpperCase()}

  </div>



  <div className="account-copy">

    <strong>{authUser.full_name}</strong>

    <span>{authUser.role} account</span>

  </div>



  <button

    type="button"

    className="account-settings"

    title="Log out"

    aria-label="Log out"

    onClick={() => {

      logout();

      setAuthUser(null);

      setAuthPage("landing");

    }}

  >

    <span style={{ fontSize: 12 }}>Logout</span>

  </button>

</div>

        </div>

      </aside>



      <main className="main-area">

        <header className="topbar">

          <div className="breadcrumb">

            <button className="mobile-menu-button icon-button" onClick={() => setMobileMenu(true)}><Menu size={21} /></button>

            Workspace <span>/</span> <strong>{activePage}</strong>

          </div>

          <div className="topbar-right">

            <label className="search-field">

              <Search size={17} />

              <input
                ref={searchInputRef}
                value={search}
                onChange={event => {
                  setSearch(event.target.value);
                  setSearchOpen(true);
                }}
                onKeyDown={navigateFromSearch}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => window.setTimeout(() => setSearchOpen(false), 120)}
                placeholder="Search courses..."
                aria-label="Search courses or pages"
                aria-expanded={searchOpen && Boolean(search.trim())}
                aria-controls="command-search-results"
              />
              <kbd>⌘ K</kbd>
            </label>
            {searchOpen && search.trim() && (
              <div className="command-palette" id="command-search-results" role="listbox" aria-label="Matching pages">
                {navigation.flatMap((group) => group.items)
                  .filter((item) => item.label.toLowerCase().includes(search.trim().toLowerCase()))
                  .slice(0, 7)
                  .map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      role="option"
                      aria-selected="false"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        navigateTo(item.label);
                        setSearch("");
                        setSearchOpen(false);
                      }}
                    >
                      <item.icon size={16} />
                      <span>{item.label}</span>
                      <kbd>Enter</kbd>
                    </button>
                  ))}
                {!navigation.flatMap((group) => group.items)
                  .some((item) => item.label.toLowerCase().includes(search.trim().toLowerCase())) && (
                  <p>Course search is active. Press Enter to filter course results.</p>
                )}
              </div>
            )}
            <ThemeSwitch />
            <NotificationBell onNavigate={navigateTo} />

            <div className="top-avatar" aria-label={authUser.full_name}>
              {authUser.full_name
                .split(/\s+/)
                .map((part) => part[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </div>

          </div>

        </header>



        <div ref={pageContentRef} className={`page-content${pageTransitioning ? ' page-transitioning' : ''}`} aria-busy={pageTransitioning} inert={pageTransitioning}>

          <div className="welcome-row">

            <div>

              <div className="eyebrow"><span /> {isTeacher ? 'FACULTY WORKSPACE' : 'STUDENT WORKSPACE'}</div>

              <h1>{activePage === 'Overview' ? `Welcome back, ${displayName}` : activePage}<span className="heading-star"> ✳</span></h1>

              <p className="page-description">{descriptions[activePage] || 'Your classroom workspace, all in one place.'}</p>

            </div>

            <div className="welcome-actions">

              <button className="button-secondary" onClick={() => navigateTo('Calendar')}>

                <CalendarDays size={16} /> View calendar

              </button>

              {isTeacher ? (
                <button className="button-primary" onClick={() => navigateTo('Assignments')}>
                  <Plus size={17} /> Create assignment
                </button>
              ) : (
                <button className="button-primary" onClick={() => navigateTo('My Courses')}>
                  <BookOpen size={17} /> Explore courses
                </button>
              )}

            </div>

          </div>



          <Suspense fallback={<div className="cp-skeleton" style={{ height: 240 }} role="status" aria-label="Loading workspace page" />}>
            {(activePage === 'Overview' || activePage === 'My Courses' || activePage === 'Assignments' || activePage === 'Attendance' || activePage === 'My Attendance' || activePage === 'Gradebook' || activePage === 'My Grades' || activePage === 'Notifications' || activePage === 'Announcements' || activePage === 'Discussions' || activePage === 'Calendar' || activePage === 'Students' || activePage === 'Analytics' || activePage === 'Doubt Box') ? (
              isTeacher ? (
                <TeacherDashboard
                  search={search}
                  page={activePage}
                  onNavigate={navigateTo}
                  currentUser={authUser}
                />
              ) : (
                <StudentDashboard
                  search={search}
                  page={activePage}
                  onNavigate={navigateTo}
                  currentUser={authUser}
                />
              )
            ) : activePage === 'AI Assistant' ? (
              <AIAssistantPage role={authUser.role} />

            ) : activePage === 'Settings' ? (
              <SettingsPage />

            ) : (

              <div className="panel placeholder-panel">

                <div className="placeholder-icon"><Sparkles size={24} /></div>

                <h2>{activePage}</h2>

                <p>{descriptions[activePage]}</p>

                <p className="placeholder-note">This section is part of the ClassPilot workspace. We'll connect its real functionality to the backend in the next development phases.</p>

                <button className="button-primary" onClick={() => navigateTo('Overview')}>Back to overview</button>

              </div>

            )}
          </Suspense>



          <footer className="footer"><span>© 2026 ClassPilot · Classroom management, reimagined.</span><span><i /> All systems operational</span></footer>

        </div>

      </main>

    </div>
    </NotificationProvider>
    </ToastProvider>

  );

}



export default App;
