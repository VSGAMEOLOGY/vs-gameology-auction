"use client";

import { useState } from "react";
import { MapPin, Star, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import type { ShippingAddress } from "@/types/database";

interface AddressManagerProps {
  addresses: ShippingAddress[];
  userId: string;
}

const emptyForm = {
  label: "Home",
  recipient_name: "",
  phone: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  postal_code: "",
  country: "Malaysia",
  is_default: false,
};

export function AddressManager({ addresses: initial, userId }: AddressManagerProps) {
  const [addresses, setAddresses] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data, error: insertError } = await supabase
      .from("shipping_addresses")
      .insert({ ...form, user_id: userId })
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
    } else if (data) {
      setAddresses((prev) => {
        const updated = form.is_default
          ? prev.map((a) => ({ ...a, is_default: false }))
          : prev;
        return [...updated, data];
      });
      setForm(emptyForm);
      setShowForm(false);
    }
    setLoading(false);
  }

  async function setDefault(id: string) {
    await supabase
      .from("shipping_addresses")
      .update({ is_default: true })
      .eq("id", id);
    setAddresses((prev) =>
      prev.map((a) => ({ ...a, is_default: a.id === id }))
    );
  }

  async function remove(id: string) {
    await supabase.from("shipping_addresses").delete().eq("id", id);
    setAddresses((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <div className="space-y-4">
      {addresses.map((addr) => (
        <Card key={addr.id}>
          <CardContent className="flex items-start justify-between py-4">
            <div className="flex gap-3">
              <MapPin className="mt-0.5 h-5 w-5 text-gray-400" />
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900">{addr.label}</p>
                  {addr.is_default && (
                    <span className="rounded bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
                      Default
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600">{addr.recipient_name}</p>
                <p className="text-sm text-gray-600">
                  {addr.address_line1}
                  {addr.address_line2 && `, ${addr.address_line2}`}
                </p>
                <p className="text-sm text-gray-600">
                  {addr.city}, {addr.state} {addr.postal_code}, {addr.country}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {!addr.is_default && (
                <Button variant="ghost" size="sm" onClick={() => setDefault(addr.id)} title="Set as default">
                  <Star className="h-4 w-4" />
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => remove(addr.id)} title="Delete">
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {showForm ? (
        <Card>
          <CardContent className="py-4">
            <form onSubmit={handleAdd} className="space-y-3">
              {error && <Alert variant="error">{error}</Alert>}
              <div>
  <label className="text-sm font-medium">Label</label>
  <select
    value={form.label}
    onChange={(e) => setForm({ ...form, label: e.target.value })}
    className="w-full rounded-md border border-gray-300 px-3 py-2"
  >
    <option value="Home">Home</option>
    <option value="Office">Office</option>
    <option value="Relative House">Relative House</option>
  </select>
</div>
                <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                <Input label="Address Line 1" value={form.address_line1} onChange={(e) => setForm({ ...form, address_line1: e.target.value })} required className="sm:col-span-2" />
                <Input label="Address Line 2" value={form.address_line2} onChange={(e) => setForm({ ...form, address_line2: e.target.value })} className="sm:col-span-2" />
                <Input label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required />
                <div>
  <label className="text-sm font-medium">State</label>
  <select
    value={form.state}
    onChange={(e) => setForm({ ...form, state: e.target.value })}
    className="w-full rounded-md border border-gray-300 px-3 py-2"
    required
  >
    <option value="">Select State</option>
    <option value="Johor">Johor</option>
    <option value="Kedah">Kedah</option>
    <option value="Kelantan">Kelantan</option>
    <option value="Melaka">Melaka</option>
    <option value="Negeri Sembilan">Negeri Sembilan</option>
    <option value="Pahang">Pahang</option>
    <option value="Perak">Perak</option>
    <option value="Perlis">Perlis</option>
    <option value="Penang">Penang</option>
    <option value="Sabah">Sabah</option>
    <option value="Sarawak">Sarawak</option>
    <option value="Selangor">Selangor</option>
    <option value="Terengganu">Terengganu</option>
    <option value="Kuala Lumpur">Kuala Lumpur</option>
    <option value="Putrajaya">Putrajaya</option>
    <option value="Labuan">Labuan</option>
  </select>
</div>
<div className="grid gap-4 sm:grid-cols-2">
  <Input
    label="Postal Code"
    value={form.postal_code}
    onChange={(e) =>
      setForm({ ...form, postal_code: e.target.value })
    }
    required
  />

  <Input
    label="Country"
    value={form.country}
  readOnly
    />
</div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_default}
                  onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                  className="rounded border-gray-300"
                />
                Set as default address
              </label>
              <div className="flex gap-2">
                <Button type="submit" loading={loading}>Add Address</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Button variant="outline" onClick={() => setShowForm(true)}>
          Add Shipping Address
        </Button>
      )}
    </div>
  );
}
