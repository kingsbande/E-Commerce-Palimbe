import Placeholder from "../../components/Placeholder";
import SignInPrompt from "../../components/SignInPrompt";
import { useAuth } from "../../lib/auth";

export default function Orders() {
  const { session, loading } = useAuth();

  if (loading) return null;
  if (!session) return <SignInPrompt message="Sign in to see your orders." />;
  return <Placeholder title="My Orders" />;
}
