import { Link } from 'react-router-dom'
import { Header } from '../components/Header'

export function NotFound({ what = 'Page' }: { what?: string }) {
  return (
    <div className="page">
      <Header subtitle="Medical billing desk" />
      <div className="empty">
        {what} not found. The bridge may be offline and there is no fixture for it.{' '}
        <Link to="/case/4471">Go to case 4471</Link>
      </div>
    </div>
  )
}
