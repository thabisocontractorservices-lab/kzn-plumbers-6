import { RegisterWizard } from "@/components/RegisterWizard";

export const metadata = {
  title: "List Your Business — KZN Plumbers Directory",
};

export default function RegisterPage() {
  return (
    <div className="min-h-[calc(100vh-64px)] flex justify-center py-12 px-6 bg-gradient-to-b from-brand-light to-[#F4F6FB]">
      <div className="w-full max-w-2xl bg-white rounded-2xl border border-gray-200 shadow-floating p-10">
        <h1 className="font-display text-3xl text-center mb-1">
          List your plumbing business
        </h1>
        <p className="text-center text-gray-500 mb-8 text-sm">
          Join 112+ verified plumbers across KZN. It's free.
        </p>
        <RegisterWizard />
      </div>
    </div>
  );
}
