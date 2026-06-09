"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Profile } from "@/types/database";

interface UserActionsProps {
  user: Profile;
}

export function UserActions({ user }: UserActionsProps) {
  const [showSuspend, setShowSuspend] = useState(false);
  const [reason, setReason] = useState("");
  const [until, setUntil] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function toggleRole() {
    setLoading(true);
    const newRole = user.role === "admin" ? "user" : "admin";
    await supabase.from("profiles").update({ role: newRole }).eq("id", user.id);
    window.location.reload();
  }

  async function suspend(type: "temporary" | "permanent") {
    if (!reason) return;
    setLoading(true);

    const { data: { user: admin } } = await supabase.auth.getUser();

    await supabase.from("profiles").update({
      is_suspended: true,
      suspension_reason: reason,
      suspended_until: type === "temporary" && until ? new Date(until).toISOString() : null,
    }).eq("id", user.id);

    await supabase.from("suspension_history").insert({
      user_id: user.id,
      suspended_by: admin!.id,
      type,
      reason,
      suspended_until: type === "temporary" && until ? new Date(until).toISOString() : null,
    });

    if (type === "permanent") {
      await supabase.from("blacklist").insert({
        email: user.email,
        reason,
        blacklisted_by: admin!.id,
      });
    }

    await supabase.from("notifications").insert({
      user_id: user.id,
      type: "account_suspended",
      title: "Account Suspended",
      message: reason,
    });

    window.location.reload();
  }

  async function unsuspend() {
    setLoading(true);
    await supabase.from("profiles").update({
      is_suspended: false,
      suspension_reason: null,
      suspended_until: null,
    }).eq("id", user.id);
    window.location.reload();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={toggleRole} loading={loading}>
        {user.role === "admin" ? "Remove Admin" : "Make Admin"}
      </Button>

      {user.is_suspended ? (
        <Button variant="secondary" size="sm" onClick={unsuspend} loading={loading}>
          Unsuspend
        </Button>
      ) : (
        <Button variant="danger" size="sm" onClick={() => setShowSuspend(!showSuspend)}>
          Suspend
        </Button>
      )}

      {showSuspend && (
        <div className="w-full space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <Input
            label="Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for suspension"
          />
          <Input
            label="Suspend Until (optional, for temporary)"
            type="datetime-local"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
          />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => suspend("temporary")} loading={loading}>
              Temporary Suspend
            </Button>
            <Button size="sm" variant="danger" onClick={() => suspend("permanent")} loading={loading}>
              Permanent Blacklist
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
