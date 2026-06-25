"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    const trimmedUsername = username.trim();

    const { data: usernameTaken, error: usernameCheckError } = await supabase.rpc(
      "is_username_taken",
      { p_username: trimmedUsername }
    );

    if (usernameCheckError) {
      setError(usernameCheckError.message);
      setLoading(false);
      return;
    }

    if (usernameTaken) {
      setError("This username is already taken. Please choose another.");
      setLoading(false);
      return;
    }

    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username: trimmedUsername } },
    });

    if (authError) {
      if (/already registered|already been registered/i.test(authError.message)) {
        setError("This email is already registered. Please login or use a different email.");
      } else {
        setError(authError.message);
      }
      setLoading(false);
      return;
    }

    // Supabase returns a user with no identities (and no error) when the
    // email already belongs to an existing account, to avoid leaking which
    // emails are registered.
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      setError("This email is already registered. Please login or use a different email.");
      setLoading(false);
      return;
    }

    setSuccess("Account created! Check your email to verify, then sign in.");
    setLoading(false);
    setTimeout(() => router.push("/login"), 2000);
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <Alert variant="error">{error}</Alert>}
            {success && <Alert variant="success">{success}</Alert>}
            <Input
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
            <Button type="submit" className="w-full" loading={loading}>
              Create Account
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-gray-600">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
