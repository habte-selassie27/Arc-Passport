import { RegisterForm } from "../components/forms/RegisterForm";
import { useWallet } from "../contexts/WalletContext";

export function RegisterPage() {
  const { isConnected } = useWallet();

  if (!isConnected) {
    return (
      <div className="text-center py-16 animate-fade-in">
        <p className="text-gray-600 dark:text-gray-400">Connect your wallet to register an identity.</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto py-12 px-4 animate-fade-in">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">Register Identity</h1>
      <RegisterForm />
    </div>
  );
}
