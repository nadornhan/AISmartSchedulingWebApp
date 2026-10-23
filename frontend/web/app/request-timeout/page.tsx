import { ErrorStatusPage } from '../../components/errors/error-status-page';

export default function RequestTimeoutPage() {
  return <ErrorStatusPage kind="timeout" />;
}
