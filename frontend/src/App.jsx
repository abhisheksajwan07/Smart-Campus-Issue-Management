import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import { RequireAuth, GuestOnly } from "./components/Protected";
import Login from "./pages/Login";
import Activate from "./pages/Activate";
import Dashboard from "./pages/Dashboard";
import Complaints from "./pages/Complaints";
import ComplaintDetail from "./pages/ComplaintDetail";
import NewComplaint from "./pages/NewComplaint";
import Departments from "./pages/Departments";
import Roster from "./pages/Roster";
import Team from "./pages/Team";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <Routes>
      <Route element={<GuestOnly />}>
        <Route path="/login" element={<Login />} />
        <Route path="/activate" element={<Activate />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="complaints" element={<Complaints />} />
          <Route path="complaints/:id" element={<ComplaintDetail />} />
          <Route path="report" element={<NewComplaint />} />
          <Route path="profile" element={<Profile />} />
          <Route element={<RequireAuth roles={["ADMIN", "STAFF"]} />}>
            <Route path="departments" element={<Departments />} />
          </Route>
          <Route element={<RequireAuth roles={["ADMIN"]} />}>
            <Route path="roster" element={<Roster />} />
            <Route path="team" element={<Team />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  );
}
