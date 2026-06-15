import { VerifyForm } from "../components/forms/VerifyForm";

export function VerifyPage() {
  return (
    <div className="max-w-lg mx-auto py-12 px-4 animate-fade-in">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">Verify Credential</h1>
      <VerifyForm />
    </div>
  );
}
