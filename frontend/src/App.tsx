import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { PlayPage } from './pages/PlayPage';
import { ResultPage } from './pages/ResultPage';
import { PublicLeaderboardPage } from './pages/PublicLeaderboardPage';
import { PlaytestJoinPage } from './pages/PlaytestJoinPage';
import { PlaytestPlayPage } from './pages/PlaytestPlayPage';
import { PlaytestResultPage } from './pages/PlaytestResultPage';
import { TeacherLoginPage } from './pages/teacher/TeacherLoginPage';
import { TeacherRegisterPage } from './pages/teacher/TeacherRegisterPage';
import { TeacherLayout } from './features/teacher/TeacherLayout';
import { TeacherDashboardPage } from './pages/teacher/TeacherDashboardPage';
import { TeacherPuzzlesPage } from './pages/teacher/TeacherPuzzlesPage';
import { TeacherGroupsPage } from './pages/teacher/TeacherGroupsPage';
import { TeacherCompetitionsPage } from './pages/teacher/TeacherCompetitionsPage';
import { TeacherCompetitionDetailPage } from './pages/teacher/TeacherCompetitionDetailPage';
import { TeacherAuditPage } from './pages/teacher/TeacherAuditPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Participant & Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/join" element={<Navigate to="/" replace />} />
        <Route path="/play" element={<PlayPage />} />
        <Route path="/result" element={<ResultPage />} />
        <Route path="/leaderboard/:code" element={<PublicLeaderboardPage />} />

        {/* Playtest Routes */}
        <Route path="/playtest" element={<PlaytestJoinPage />} />
        <Route path="/playtest/play" element={<PlaytestPlayPage />} />
        <Route path="/playtest/result" element={<PlaytestResultPage />} />

        {/* Teacher Auth Routes */}
        <Route path="/teacher/login" element={<TeacherLoginPage />} />
        <Route path="/teacher/register" element={<TeacherRegisterPage />} />

        {/* Protected Teacher Workspace Routes */}
        <Route path="/teacher" element={<TeacherLayout />}>
          <Route index element={<TeacherDashboardPage />} />
          <Route path="puzzles" element={<TeacherPuzzlesPage />} />
          <Route path="groups" element={<TeacherGroupsPage />} />
          <Route path="competitions" element={<TeacherCompetitionsPage />} />
          <Route path="competitions/:id" element={<TeacherCompetitionDetailPage />} />
          <Route path="audit" element={<TeacherAuditPage />} />
        </Route>

        {/* Catch-all fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

