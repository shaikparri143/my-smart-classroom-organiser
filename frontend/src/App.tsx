import { useState } from "react";
import {
  LayoutDashboard, BookOpen, CalendarDays, ClipboardCheck, Users,
  GraduationCap, ChartNoAxesCombined, MessageSquare, Bell, Settings,
  Search, Plus, ArrowUpRight, ArrowDownRight, Clock, MoreHorizontal,
  ChevronDown, Sparkles, CheckCircle2, CircleAlert, Menu, X,
  FileText, LogOut, Command, BrainCircuit, CalendarCheck
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar
} from "recharts";
import "./index.css";

const navGroups = [
  { label: "WORKSPACE", items: [
    { name: "Overview", icon: LayoutDashboard },
    { name: "My Courses", icon: BookOpen },
    { name: "Calendar", icon: CalendarDays },
    { name: "Attendance", icon: ClipboardCheck },
    { name: "Assignments", icon: FileText },
  ]},
  { label: "ACADEMIC", items: [
    { name: "Students", icon: Users },
    { name: "Gradebook", icon: GraduationCap },
    { name: "Analytics", icon: ChartNoAxesCombined },
  ]},
  { label: "COMMUNICATION", items: [
    { name: "Doubt Box", icon: MessageSquare },
    { name: "AI Assistant", icon: BrainCircuit },
  ]},
];

const activityData = [
  { day: "Mon", attendance: 83, submissions: 65 },
  { day: "Tue", attendance: 91, submissions: 72 },
  { day: "Wed", attendance: 87, submissions: 80 },
  { day: "Thu", attendance: 94, submissions: 76 },
  { day: "Fri", attendance: 89, submissions: 91 },
  { day: "Sat", attendance: 96, submissions: 84 },
  { day: "Sun", attendance: 92, submissions: 88 },
];

const courses = [
  { code: "CS301", title: "Machine Learning", students: 48, progress: 76, color: "purple", tag: "In progress", initials: "ML" },
  { code: "CS402", title: "Deep Learning", students: 36, progress: 58, color: "blue", tag: "In progress", initials: "DL" },
  { code: "CS305", title: "Natural Language Processing", students: 42, progress: 84, color: "green", tag: "On track", initials: "NLP" },
];

const tasks = [
  { title: "Review ML assignment submissions", subtitle: "Machine Learning · 18 submissions", time: "Today", status: "Pending", color: "orange" },
  { title: "Publish Deep Learning quiz", subtitle: "Deep Learning · Chapter 4", time: "Today", status: "Upcoming", color: "blue" },
  { title: "Finalize weekly attendance", subtitle: "NLP · Section A", time: "Tomorrow", status: "In progress", color: "purple" },
];

const sessions = [
  { time: "09:00 AM", duration: "60 min", title: "Machine Learning", room: "Room 302 · Section A", color: "purple" },
  { time: "11:00 AM", duration: "60 min", title: "Deep Learning", room: "Lab 204 · Section B", color: "blue" },
  { time: "02:00 PM", duration: "90 min", title: "Natural Language Processing", room: "Room 108 · Section A", color: "green" },
];

function App() {
  const [active, setActive] = useState("Overview");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");

  const pageDescriptions: Record<string, string> = {
    Overview: "Here's what's happening in your classroom today.",
    "My Courses": "Manage your courses, materials and enrolled students.",
    Calendar: "Plan your teaching schedule and upcoming academic events.",
    Attendance: "Track class attendance and monitor participation.",
    Assignments: "Create assignments, review submissions and provide feedback.",
    Students: "View your students and follow their academic progress.",
    Gradebook: "Review scores and manage student grades.",
    Analytics: "Understand classroom performance with learning insights.",
    "Doubt Box": "Collect student questions and help resolve doubts.",
    "AI Assistant": "Your AI-powered teaching and classroom planning companion.",
    Settings: "Manage your workspace preferences.",
  };

  const goTo = (name: string) => {
    setActive(name);
    setMobileOpen(false);
    setQuery("");
  };

  const filteredCourses = courses.filter(c =>
    (c.title + c.code).toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="app-shell">
      {mobileOpen && <button className="mobile-scrim" onClick={() => setMobileOpen(false)} aria-label="Close menu" />}
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><GraduationCap size={24} strokeWidth={2.3} /></div>
          <div className="brand-name">classpilot<span>.</span><small>CLASSROOM OS</small></div>
          <button className="icon-button mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close sidebar"><X size={19} /></button>
        </div>

        <button className="workspace-switch">
          <div className="workspace-avatar">SR</div>
          <div className="workspace-info"><strong>SRM Classroom</strong><span>Faculty workspace</span></div>
          <ChevronDown size={16} className="muted-icon" />
        </button>

        <div className="nav-scroll">
          {navGroups.map(group => (
            <div className="nav-group" key={group.label}>
              <div className="nav-label">{group.label}</div>
              {group.items.map(item => {
                const Icon = item.icon;
                return (
                  <button key={item.name} className={`nav-item ${active === item.name ? "nav-active" : ""}`} onClick={() => goTo(item.name)}>
                    <Icon size={18} strokeWidth={1.8} />
                    <span>{item.name}</span>
                    {item.name === "Assignments" && <span className="nav-count">4</span>}
                    {item.name === "Doubt Box" && <span className="nav-dot" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="sidebar-bottom">
          <button className={`nav-item ${active === "Settings" ? "nav-active" : ""}`} onClick={() => goTo("Settings")}><Settings size={18} /><span>Settings</span></button>
          <div className="plan-card">
            <div className="plan-icon"><Sparkles size={17} /></div>
            <strong>Teach smarter with AI</strong>
            <p>Spend less time on admin. Focus more on students.</p>
            <button onClick={() => goTo("AI Assistant")}>Explore AI tools <ArrowUpRight size={14} /></button>
          </div>
          <button className="profile-row" onClick={() => setShowProfile(!showProfile)}>
            <div className="profile-avatar">RK</div>
            <div className="profile-info"><strong>Rohit Kumar</strong><span>Faculty account</span></div>
            <MoreHorizontal size={19} className="muted-icon" />
          </button>
          {showProfile && <div className="profile-popover"><button onClick={() => goTo("Settings")}><Settings size={15} /> Account settings</button><button onClick={() => setShowProfile(false)}><LogOut size={15} /> Close menu</button></div>}
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu size={21} /></button>
            <div className="breadcrumb">Workspace <span>/</span> <strong>{active}</strong></div>
          </div>
          <div className="topbar-actions">
            <label className="search-box"><Search size={17} /><input placeholder="Search anything..." value={query} onChange={e => setQuery(e.target.value)} /><kbd><Command size={11} /> K</kbd></label>
            <div className="notification-wrap">
              <button className="icon-button notification-button" aria-label="Notifications" onClick={() => setShowNotifications(!showNotifications)}><Bell size={19} /><span /></button>
              {showNotifications && <div className="notification-popover"><strong>Notifications</strong><p><span className="notification-dot" /> 18 new assignment submissions need review.</p><p><span className="notification-dot blue-dot" /> Your next class starts at 11:00 AM.</p><p><span className="notification-dot green-dot" /> Weekly report is ready to review.</p></div>}
            </div>
            <div className="topbar-divider" />
            <button className="top-profile" onClick={() => setShowProfile(!showProfile)}><div className="profile-avatar small-avatar">RK</div><ChevronDown size={15} /></button>
          </div>
        </header>

        <div className="page-content">
          <div className="welcome-row">
            <div>
              <div className="eyebrow"><span className="live-dot" /> TUESDAY, OCTOBER 13, 2026</div>
              <h1>{active === "Overview" ? "Good morning, Rohit" : active}<span className="wave"> {active === "Overview" ? "✦" : ""}</span></h1>
              <p className="page-subtitle">{pageDescriptions[active] || "Your classroom workspace, all in one place."}</p>
            </div>
            <div className="welcome-actions">
              <button className="button button-secondary" onClick={() => goTo("Calendar")}><CalendarDays size={16} /> View calendar</button>
              <button className="button button-primary" onClick={() => goTo(active === "Assignments" ? "My Courses" : "Assignments")}><Plus size={17} /> {active === "Assignments" ? "View courses" : "Create assignment"}</button>
            </div>
          </div>

          {active === "Overview" ? (
            <>
              <section className="stats-grid">
                <div className="stat-card"><div className="stat-top"><span>Total students</span><div className="stat-icon lavender"><Users size={19} /></div></div><div className="stat-value">126 <span className="trend up"><ArrowUpRight size={14} /> 8.2%</span></div><div className="stat-foot">Across 3 active courses</div><div className="mini-bars">{[35,48,38,62,45,75,56,88,64,77,60,94].map((h,i)=><i key={i} style={{height:`${h}%`}} />)}</div></div>
                <div className="stat-card"><div className="stat-top"><span>Average attendance</span><div className="stat-icon mint"><CalendarCheck size={19} /></div></div><div className="stat-value">92.4% <span className="trend up"><ArrowUpRight size={14} /> 2.4%</span></div><div className="stat-foot">Compared to last month</div><div className="progress-track"><div className="progress-fill mint-fill" style={{width:"92.4%"}} /></div><div className="progress-caption"><span>Class participation</span><strong>Excellent</strong></div></div>
                <div className="stat-card"><div className="stat-top"><span>Pending submissions</span><div className="stat-icon peach"><FileText size={19} /></div></div><div className="stat-value">18 <span className="trend down"><ArrowDownRight size={14} /> 3.1%</span></div><div className="stat-foot">Across all assignments</div><div className="pending-dots"><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /></div></div>
                <div className="stat-card"><div className="stat-top"><span>Active courses</span><div className="stat-icon sky"><BookOpen size={19} /></div></div><div className="stat-value">03 <span className="stat-small">this semester</span></div><div className="stat-foot">All courses are on track</div><div className="course-avatars"><span>ML</span><span>DL</span><span>NL</span><b>+0</b></div></div>
              </section>

              <section className="main-grid">
                <div className="panel performance-panel">
                  <div className="panel-heading"><div><h2>Classroom activity</h2><p>Attendance and assignment engagement</p></div><button className="select-button" onClick={() => goTo("Analytics")}>This week <ChevronDown size={14} /></button></div>
                  <div className="chart-legend"><span><i className="legend-dot purple-dot" /> Attendance</span><span><i className="legend-dot blue-dot" /> Submissions</span></div>
                  <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={activityData} margin={{top:8,right:6,left:-22,bottom:0}}><defs><linearGradient id="attendanceFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8170e8" stopOpacity={0.18}/><stop offset="100%" stopColor="#8170e8" stopOpacity={0}/></linearGradient><linearGradient id="submissionFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#65a8ed" stopOpacity={0.15}/><stop offset="100%" stopColor="#65a8ed" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 4" vertical={false} stroke="#edf0f5"/><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill:"#8b92a5",fontSize:12}} dy={10}/><YAxis axisLine={false} tickLine={false} tick={{fill:"#8b92a5",fontSize:11}} domain={[40,100]} ticks={[40,60,80,100]}/><Tooltip contentStyle={{border:"1px solid #e9eaf1",borderRadius:12,fontSize:12,boxShadow:"0 8px 24px #18213a12"}}/><Area type="monotone" dataKey="attendance" name="Attendance" stroke="#8170e8" strokeWidth={2.5} fill="url(#attendanceFill)" activeDot={{r:5}}/><Area type="monotone" dataKey="submissions" name="Submissions" stroke="#65a8ed" strokeWidth={2.5} fill="url(#submissionFill)" activeDot={{r:5}}/></AreaChart></ResponsiveContainer></div>
                  <div className="chart-footer"><span><span className="chart-status-dot" /> Data from the current week</span><button onClick={() => goTo("Analytics")}>View analytics <ArrowUpRight size={14}/></button></div>
                </div>

                <div className="panel schedule-panel">
                  <div className="panel-heading"><div><h2>Today's schedule</h2><p>Your upcoming teaching sessions</p></div><button className="icon-button" aria-label="Schedule options" onClick={() => goTo("Calendar")}><MoreHorizontal size={20}/></button></div>
                  <div className="schedule-date"><div className="date-tile"><span>OCT</span><strong>13</strong></div><div><strong>Tuesday</strong><span>3 classes scheduled</span></div><button className="schedule-calendar" onClick={() => goTo("Calendar")}><CalendarDays size={17}/></button></div>
                  <div className="session-list">{sessions.map((s,i)=><div className="session" key={s.title}><div className="session-time"><strong>{s.time}</strong><span>{s.duration}</span></div><div className={`session-marker ${s.color}`} /><div className="session-details"><strong>{s.title}</strong><span>{s.room}</span></div><button className="session-more" aria-label="Session details" onClick={() => goTo("Calendar")}><ArrowUpRight size={15}/></button></div>)}</div>
                  <button className="full-width-link" onClick={() => goTo("Calendar")}>View full schedule <ArrowUpRight size={15}/></button>
                </div>
              </section>

              <section className="bottom-grid">
                <div className="panel courses-panel">
                  <div className="panel-heading"><div><h2>Your courses</h2><p>Quick overview of your active courses</p></div><button className="text-link" onClick={() => goTo("My Courses")}>All courses <ArrowUpRight size={14}/></button></div>
                  <div className="course-table"><div className="course-table-head"><span>COURSE</span><span>STUDENTS</span><span>PROGRESS</span><span>STATUS</span><span /></div>{filteredCourses.map(c=><div className="course-row" key={c.code}><div className="course-identity"><div className={`course-icon ${c.color}`}>{c.initials}</div><div><strong>{c.title}</strong><span>{c.code}</span></div></div><div className="student-count"><Users size={14}/>{c.students}</div><div className="course-progress"><div className="progress-track"><div className={`progress-fill ${c.color}-fill`} style={{width:`${c.progress}%`}}/></div><span>{c.progress}%</span></div><div><span className={`status-pill ${c.color === "green" ? "status-green" : "status-purple"}`}><i/> {c.tag}</span></div><button className="icon-button row-more" aria-label={`Open ${c.title}`} onClick={() => goTo("My Courses")}><ArrowUpRight size={16}/></button></div>)}{filteredCourses.length===0 && <div className="empty-search">No courses match "{query}".</div>}</div>
                </div>

                <div className="panel tasks-panel">
                  <div className="panel-heading"><div><h2>Tasks to focus on</h2><p>Your priorities for today</p></div><span className="task-count">3 tasks</span></div>
                  <div className="task-list">{tasks.map(t=><button className="task-row" key={t.title} onClick={() => goTo("Assignments")}><div className={`task-icon ${t.color}`}>{t.color==="orange"?<Clock size={17}/>:t.color==="blue"?<FileText size={17}/>:<ClipboardCheck size={17}/>}</div><div className="task-copy"><strong>{t.title}</strong><span>{t.subtitle}</span><small><span className={`task-status ${t.color}`}>{t.status}</span><span>· {t.time}</span></small></div><ArrowUpRight size={15} className="task-arrow"/></button>)}</div>
                  <button className="full-width-link" onClick={() => goTo("Assignments")}>View all tasks <ArrowUpRight size={15}/></button>
                </div>
              </section>

              <section className="ai-banner"><div className="ai-banner-icon"><Sparkles size={23}/></div><div className="ai-banner-copy"><span>INTRODUCING CLASSPILOT AI</span><h2>Your teaching assistant, ready when you are.</h2><p>Plan lessons, draft assignments and discover student learning patterns in less time.</p></div><button className="button ai-banner-button" onClick={() => goTo("AI Assistant")}>Explore AI assistant <ArrowUpRight size={16}/></button><div className="ai-decoration">✳</div></section>
            </>
          ) : (
            <section className="feature-page">
              {active === "AI Assistant" ? (
                <div className="ai-workspace"><div className="ai-workspace-icon"><Sparkles size={27}/></div><span className="ai-kicker">CLASSPILOT AI</span><h2>What can I help you teach today?</h2><p>Get started with lesson plans, assignment ideas, study materials or student progress insights.</p><div className="ai-suggestions"><button onClick={() => setAiPrompt("Create a 45-minute lesson plan for an introduction to machine learning.")}><BookOpen size={17}/> Create a lesson plan <ArrowUpRight size={14}/></button><button onClick={() => setAiPrompt("Draft a 10-question quiz on neural networks with answers.")}><FileText size={17}/> Draft a quiz <ArrowUpRight size={14}/></button><button onClick={() => setAiPrompt("Suggest ways to support students who are falling behind.")}><BrainCircuit size={17}/> Student learning insights <ArrowUpRight size={14}/></button></div><div className="ai-input-wrap"><textarea value={aiPrompt} onChange={e=>setAiPrompt(e.target.value)} placeholder="Ask ClassPilot AI anything about your classroom..." rows={3}/><button disabled={!aiPrompt.trim()} onClick={()=>setAiAnswer("AI is not connected to a provider yet. This interface is ready; we'll connect the secure backend AI integration in a later phase.")}><Sparkles size={16}/> Ask assistant</button></div>{aiAnswer && <div className="ai-answer"><strong><Sparkles size={16}/> ClassPilot assistant</strong><p>{aiAnswer}</p></div>}</div>
              ) : active === "My Courses" ? (
                <><div className="feature-heading"><div><h2>Course overview</h2><p>Three courses in your teaching workspace.</p></div><button className="button button-primary" onClick={()=>alert("Course creation will be connected to the backend in the next phase.")}><Plus size={16}/> Add course</button></div><div className="feature-course-grid">{filteredCourses.map(c=><div className="feature-course-card" key={c.code}><div className={`course-icon large-course-icon ${c.color}`}>{c.initials}</div><span className="course-code">{c.code}</span><h3>{c.title}</h3><p><Users size={15}/> {c.students} students</p><div className="progress-track"><div className={`progress-fill ${c.color}-fill`} style={{width:`${c.progress}%`}}/></div><span className="feature-progress-label">{c.progress}% course progress</span><button className="button button-secondary" onClick={()=>goTo("Students")}>View students <ArrowUpRight size={14}/></button></div>)}</div></>
              ) : (
                <div className="coming-panel"><div className="coming-icon"><LayoutDashboard size={25}/></div><h2>{active}</h2><p>{pageDescriptions[active]}</p><div className="coming-status"><CheckCircle2 size={17}/> Workspace navigation is ready</div><p className="coming-note">Next, we'll connect this section to the FastAPI backend and PostgreSQL so actions use real stored data.</p><button className="button button-primary" onClick={()=>goTo("Overview")}>Back to overview</button></div>
              )}
            </section>
          )}

          <footer className="footer"><span>© 2026 ClassPilot · Classroom management, reimagined.</span><span><i className="footer-status"/> All systems operational <span className="footer-separator">·</span> Built for better learning</span></footer>
        </div>
      </main>
    </div>
  );
}

export default App;
