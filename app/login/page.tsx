import { LoginForm } from "@/components/LoginForm";

export const metadata = { title: "Login — KZN Plumbers Directory" };

export default function LoginPage() {
  return (
    <div className="min-h-[calc(100vh-64px)] flex justify-center items-start py-12 px-6 bg-gradient-to-b from-brand-light to-[#F4F6FB]">
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-floating p-10">
        <h1 className="font-display text-3xl text-center mb-1">Welcome back</h1>
        <p className="text-center text-gray-500 mb-8 text-sm">
          Login to manage your bookings and reviews
        </p>
        <LoginForm />
      </div>
    </div>
  );
}
