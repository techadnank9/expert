import { Route, Routes } from 'react-router-dom'
import { Worker } from './pages/Worker'
import { Supervisor } from './pages/Supervisor'
import { BoardPage } from './pages/Board'
import { Brief } from './pages/Brief'
import { PostJob } from './pages/PostJob'
import { PosterProgress } from './pages/PosterProgress'
import { PosterReview } from './pages/PosterReview'
import { NotFound } from './pages/NotFound'
import { Landing } from './pages/Landing'
import { Onboard } from './pages/Onboard'
import { HowItWorks } from './pages/HowItWorks'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/case/:id" element={<Worker />} />
      <Route path="/case/:id/brief" element={<Brief />} />
      <Route path="/supervisor" element={<Supervisor />} />
      <Route path="/board" element={<BoardPage />} />
      <Route path="/onboard" element={<Onboard />} />
      <Route path="/how-it-works" element={<HowItWorks />} />
      <Route path="/post" element={<PostJob />} />
      <Route path="/poster/:id" element={<PosterProgress />} />
      <Route path="/poster/:id/review" element={<PosterReview />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
