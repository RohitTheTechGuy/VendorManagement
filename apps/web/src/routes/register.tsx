import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { registerSchema } from "@vendor-management/shared";
import { useAuth } from "../lib/auth-context.js";
import { errorMessage } from "../lib/auth-api.js";

export function RegisterPage() {
  const { user, loading, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ orgName: "", fullName: "", email: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  function update(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const parsed = registerSchema.safeParse(form);
    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      await register(parsed.data);
      navigate("/", { replace: true });
    } catch (error) {
      setFormError(errorMessage(error, "Could not create account. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  const field = (
    key: keyof typeof form,
    label: string,
    type: string,
    autoComplete: string,
  ) => (
    <label className="mt-4 block text-sm font-medium">
      {label}
      <input
        type={type}
        value={form[key]}
        onChange={update(key)}
        autoComplete={autoComplete}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
      />
      {fieldErrors[key] && <span className="mt-1 block text-xs text-rose-600">{fieldErrors[key][0]}</span>}
    </label>
  );

  return (
    <main className="min-h-screen grid place-items-center bg-slate-50 p-6 text-slate-900">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
      >
        <h1 className="text-2xl font-bold">Create your account</h1>
        <p className="mt-1 text-sm text-slate-500">Set up your buyer organisation</p>

        {formError && (
          <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</p>
        )}

        {field("orgName", "Organisation name", "text", "organization")}
        {field("fullName", "Your name", "text", "name")}
        {field("email", "Email", "email", "email")}
        {field("password", "Password", "password", "new-password")}

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {submitting ? "Creating…" : "Create account"}
        </button>

        <p className="mt-4 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-indigo-600 hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </main>
  );
}
