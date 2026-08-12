import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import MainLayout from './components/layout/MainLayout';

// Shared
import ProfilePage from './pages/shared/ProfilePage';

// Public
import LandingPage from './pages/public/LandingPage';

// Auth
import LoginPage from './pages/auth/LoginPage';

// Student pages
import StudentDashboard from './pages/student/StudentDashboard';
import StudentLessons from './pages/student/StudentLessons';
import LessonDetail from './pages/student/LessonDetail';

// Leads CRM + Finance (manager / admin / reception)
import ManagerLeads from './pages/manager/ManagerLeads';
import FinanceDashboard from './pages/finance/FinanceDashboard';
import FinanceExpenses from './pages/finance/FinanceExpenses';
import FinancePayroll from './pages/finance/FinancePayroll';
import StudentHomework from './pages/student/StudentHomework';
import HomeworkSubmit from './pages/student/HomeworkSubmit';
import StudentTests from './pages/student/StudentTests';
import TestRunner from './pages/student/TestRunner';
import StudentResults from './pages/student/StudentResults';
import StudentResources from './pages/student/StudentResources';
import StudentAttendance from './pages/student/StudentAttendance';
import StudentAchievements from './pages/student/StudentAchievements';
import StudentLeaderboard from './pages/student/StudentLeaderboard';
import StudentAnalytics from './pages/student/StudentAnalytics';

// Teacher pages
import TeacherDashboard from './pages/teacher/TeacherDashboard';
import ManageGroups from './pages/teacher/ManageGroups';
import GroupDetail from './pages/teacher/GroupDetail';
import ManageStudents from './pages/teacher/ManageStudents';
import ManageLessons from './pages/teacher/ManageLessons';
import CreateLesson from './pages/teacher/CreateLesson';
import ManageHomework from './pages/teacher/ManageHomework';
import CreateHomework from './pages/teacher/CreateHomework';
import GradeSubmissions from './pages/teacher/GradeSubmissions';
import ManageTests from './pages/teacher/ManageTests';
import CreateTest from './pages/teacher/CreateTest';
import TestResultsPage from './pages/teacher/TestResultsPage';
import AttendancePage from './pages/teacher/AttendancePage';
import TeacherResources from './pages/teacher/TeacherResources';
import TeacherAnalytics from './pages/teacher/TeacherAnalytics';
import TeacherVoice from './pages/teacher/TeacherVoice';

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminTeachers from './pages/admin/AdminTeachers';
import AdminReception from './pages/admin/AdminReception';
import AdminApplications from './pages/admin/AdminApplications';
import AdminStudents from './pages/admin/AdminStudents';
import AdminGroups from './pages/admin/AdminGroups';
import AdminSettings from './pages/admin/AdminSettings';
import AdminManagers from './pages/admin/AdminManagers';
import AdminManagerDetail from './pages/admin/AdminManagerDetail';
import AdminBranches from './pages/admin/AdminBranches';
import AdminBranchDetail from './pages/admin/AdminBranchDetail';
import UserDetail from './pages/shared/UserDetail';

// Manager pages
import ManagerDashboard from './pages/manager/ManagerDashboard';
import ManagerBranches from './pages/manager/ManagerBranches';
import ManagerBranchDetail from './pages/manager/ManagerBranchDetail';

// Reception pages
import ReceptionGroups from './pages/reception/ReceptionGroups';
import ReceptionGroupDetail from './pages/reception/ReceptionGroupDetail';
import ReceptionTeacherDetail from './pages/reception/ReceptionTeacherDetail';
import ReceptionStudents from './pages/reception/ReceptionStudents';
import ReceptionPayments from './pages/reception/ReceptionPayments';

const ProtectedRoute = ({ children, role }) => {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  const allowedRoles = Array.isArray(role) ? role : role ? [role] : null;
  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    if (user?.role === 'student') return <Navigate to="/student/dashboard" replace />;
    if (user?.role === 'teacher') return <Navigate to="/teacher/dashboard" replace />;
    if (user?.role === 'reception') return <Navigate to="/reception/teachers" replace />;
    if (user?.role === 'manager') return <Navigate to="/manager/dashboard" replace />;
    if (user?.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
  }
  return children;
};

export default function App() {
  const { user } = useAuthStore();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route path="/" element={
          user?.role === 'student' ? <Navigate to="/student/dashboard" replace /> :
          user?.role === 'teacher' ? <Navigate to="/teacher/dashboard" replace /> :
          user?.role === 'reception' ? <Navigate to="/reception/teachers" replace /> :
          user?.role === 'manager' ? <Navigate to="/manager/dashboard" replace /> :
          user?.role === 'admin' ? <Navigate to="/admin/dashboard" replace /> :
          <LandingPage />
        } />

        {/* Student Routes */}
        <Route path="/student" element={<ProtectedRoute role="student"><MainLayout /></ProtectedRoute>}>
          <Route path="dashboard" element={<StudentDashboard />} />
          <Route path="lessons" element={<StudentLessons />} />
          <Route path="lessons/:id" element={<LessonDetail />} />
          <Route path="homework" element={<StudentHomework />} />
          <Route path="homework/:id/submit" element={<HomeworkSubmit />} />
          <Route path="tests" element={<StudentTests />} />
          <Route path="tests/:id/run" element={<TestRunner />} />
          <Route path="results" element={<StudentResults />} />
          <Route path="resources" element={<StudentResources />} />
          <Route path="attendance" element={<StudentAttendance />} />
          <Route path="achievements" element={<StudentAchievements />} />
          <Route path="leaderboard" element={<StudentLeaderboard />} />
          <Route path="analytics" element={<StudentAnalytics />} />
        </Route>

        {/* Teacher Routes */}
        <Route path="/teacher" element={<ProtectedRoute role="teacher"><MainLayout /></ProtectedRoute>}>
          <Route path="dashboard" element={<TeacherDashboard />} />
          <Route path="groups" element={<ManageGroups />} />
          <Route path="groups/:id" element={<GroupDetail />} />
          <Route path="students" element={<ManageStudents />} />
          <Route path="lessons" element={<ManageLessons />} />
          <Route path="lessons/create" element={<CreateLesson />} />
          <Route path="lessons/:id/edit" element={<CreateLesson />} />
          {/* Teachers open the same lesson view their students see. */}
          <Route path="lessons/:id" element={<LessonDetail />} />
          <Route path="homework" element={<ManageHomework />} />
          <Route path="homework/create" element={<CreateHomework />} />
          <Route path="homework/:id/submissions" element={<GradeSubmissions />} />
          <Route path="tests" element={<ManageTests />} />
          <Route path="tests/create" element={<CreateTest />} />
          <Route path="tests/:id/results" element={<TestResultsPage />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="resources" element={<TeacherResources />} />
          <Route path="analytics" element={<TeacherAnalytics />} />
          <Route path="voice" element={<TeacherVoice />} />
        </Route>

        {/* Shared - any authenticated role */}
        <Route path="/profile" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
          <Route index element={<ProfilePage />} />
        </Route>
        <Route path="/users" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
          <Route path=":id" element={<UserDetail />} />
        </Route>

        {/* Admin Routes */}
        <Route path="/admin" element={<ProtectedRoute role="admin"><MainLayout /></ProtectedRoute>}>
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="applications" element={<AdminApplications />} />
          <Route path="branches" element={<AdminBranches />} />
          <Route path="branches/:id" element={<AdminBranchDetail />} />
          <Route path="managers" element={<AdminManagers />} />
          <Route path="managers/:id" element={<AdminManagerDetail />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>

        {/* Manager Routes */}
        <Route path="/manager" element={<ProtectedRoute role="manager"><MainLayout /></ProtectedRoute>}>
          <Route path="dashboard" element={<ManagerDashboard />} />
          <Route path="branches" element={<ManagerBranches />} />
          <Route path="branches/:id" element={<ManagerBranchDetail />} />
          <Route path="reception" element={<AdminReception />} />
          <Route path="teachers" element={<AdminTeachers />} />
          <Route path="teachers/:id" element={<ReceptionTeacherDetail />} />
          <Route path="students" element={<AdminStudents />} />
          <Route path="groups" element={<AdminGroups />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>

        {/* Leads CRM and Finance are shared by the management roles; the backend
            scopes every query to the branches the caller actually runs. */}
        <Route path="/leads" element={<ProtectedRoute role={['manager', 'admin', 'reception']}><MainLayout /></ProtectedRoute>}>
          <Route index element={<ManagerLeads />} />
        </Route>
        <Route path="/finance" element={<ProtectedRoute role={['manager', 'admin', 'reception']}><MainLayout /></ProtectedRoute>}>
          <Route index element={<FinanceDashboard />} />
          <Route path="expenses" element={<FinanceExpenses />} />
          <Route path="payroll" element={<ProtectedRoute role={['manager', 'admin']}><FinancePayroll /></ProtectedRoute>} />
        </Route>

        {/* Reception Routes - has almost all of admin's operational
            capabilities now (reuses the same Admin* components, which the
            backend allows for the 'reception' role too), plus its own
            groups/students/payments pages. */}
        <Route path="/reception" element={<ProtectedRoute role="reception"><MainLayout /></ProtectedRoute>}>
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="teachers" element={<AdminTeachers />} />
          <Route path="groups" element={<ReceptionGroups />} />
          <Route path="groups/:id" element={<ReceptionGroupDetail />} />
          <Route path="teachers/:id" element={<ReceptionTeacherDetail />} />
          <Route path="students" element={<ReceptionStudents />} />
          <Route path="payments" element={<ReceptionPayments />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
