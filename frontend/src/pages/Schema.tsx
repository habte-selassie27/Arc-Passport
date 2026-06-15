import { SchemaForm } from "../components/forms/SchemaForm";

export function SchemaPage() {
  return (
    <div className="max-w-lg mx-auto py-12 px-4 animate-fade-in">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 text-center">Register Schema</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-8">
        Create a new claim schema definition
      </p>
      <SchemaForm />
    </div>
  );
}
