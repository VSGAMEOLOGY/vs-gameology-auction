"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import type { Profile } from "@/types/database";

interface ProfileFormProps {
  profile: Profile;
}

export function ProfileForm({ profile }: ProfileFormProps) {
  const [fullName, setFullName] = useState(profile.real_name || "");
const [phone, setPhone] = useState(profile.whatsapp || "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        real_name: fullName,
        whatsapp: phone
      })
      .eq("id", profile.id);

    if (updateError) {
      setError(updateError.message);
    } else {
      setMessage("Profile updated successfully");
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <Alert variant="error">{error}</Alert>}
      {message && <Alert variant="success">{message}</Alert>}
      
      <Input label="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <Button type="submit" loading={loading}>Save Changes</Button>
    </form>
  );
}
