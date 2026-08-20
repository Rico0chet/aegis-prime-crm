import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/crm";
import {
  useAvatarUrl,
  useDeleteLicense,
  useLicenses,
  useMyProfile,
  useSaveLicense,
  useUpdateProfile,
  useUploadAvatar,
  type ProfilePatch,
} from "@/lib/profile";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Producer Profile | Aegis Prime Producer CRM" },
      {
        name: "description",
        content:
          "Manage your producer profile photo, agency details, state licenses, and public appointment records.",
      },
      { property: "og:title", content: "Producer Profile | Aegis Prime Producer CRM" },
      {
        property: "og:description",
        content:
          "Manage your producer profile photo, agency details, state licenses, and public appointment records.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

const emptyForm: ProfilePatch = {
  full_name: "",
  title: "",
  agency: "",
  phone: "",
  bio: "",
  license_number: "",
  npn: "",
  website_url: "",
  linkedin_url: "",
  surelc_url: "",
  nipr_url: "",
};

const emptyLicense = {
  state: "",
  license_number: "",
  lines_of_authority: "",
  issued_on: "",
  expires_on: "",
  is_active: true,
};

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-brand-border bg-brand-card p-6">
      <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      {description && <p className="mt-1 text-xs text-brand-muted">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  const id = label.toLowerCase().replace(/[^a-z]+/g, "-");
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder ?? ""}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function ProfilePage() {
  const { data: profile, isLoading } = useMyProfile();
  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();
  const { data: avatarUrl } = useAvatarUrl(profile?.avatar_url);
  const { data: licenses = [] } = useLicenses();
  const saveLicense = useSaveLicense();
  const deleteLicense = useDeleteLicense();
  const fileInput = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<ProfilePatch>(emptyForm);
  const [license, setLicense] = useState(emptyLicense);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setForm({
      full_name: profile.full_name ?? "",
      title: profile.title ?? "",
      agency: profile.agency ?? "",
      phone: profile.phone ?? "",
      bio: profile.bio ?? "",
      license_number: profile.license_number ?? "",
      npn: profile.npn ?? "",
      website_url: profile.website_url ?? "",
      linkedin_url: profile.linkedin_url ?? "",
      surelc_url: profile.surelc_url ?? "",
      nipr_url: profile.nipr_url ?? "",
    });
  }, [profile]);

  function set(key: keyof ProfilePatch) {
    return (value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateProfile.mutate(form, {
      onSuccess: () => toast.success("Profile updated"),
      onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save"),
    });
  }

  function handleAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Please choose an image under 5 MB");
      return;
    }
    uploadAvatar.mutate(file, {
      onSuccess: () => toast.success("Profile photo updated"),
      onError: (error) => toast.error(error instanceof Error ? error.message : "Upload failed"),
    });
    event.target.value = "";
  }

  function handleLicenseSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!license.state.trim() || !license.license_number.trim()) {
      toast.error("State and license number are required");
      return;
    }
    saveLicense.mutate(
      {
        ...(editingId ? { id: editingId } : {}),
        state: license.state.trim().toUpperCase(),
        license_number: license.license_number.trim(),
        lines_of_authority: license.lines_of_authority.trim() || null,
        issued_on: license.issued_on || null,
        expires_on: license.expires_on || null,
        is_active: license.is_active,
      },
      {
        onSuccess: () => {
          toast.success(editingId ? "License updated" : "License added");
          setLicense(emptyLicense);
          setEditingId(null);
        },
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : "Could not save license"),
      },
    );
  }

  const initials = (form.full_name ?? "").trim().slice(0, 2).toUpperCase() || "AP";

  return (
    <AppShell title="Producer Profile" eyebrow="Your credentials & public records">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-6">
          <Section title="Profile photo" description="Shown in your sidebar and on client-facing materials.">
            <div className="flex items-center gap-5">
              <div className="flex size-20 items-center justify-center overflow-hidden rounded-full bg-brand-surface ring-1 ring-brand-border">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Your profile photo"
                    className="size-full object-cover object-top"
                  />
                ) : (
                  <span className="text-lg font-semibold text-brand-muted">{initials}</span>
                )}
              </div>
              <div>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatar}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploadAvatar.isPending}
                  onClick={() => fileInput.current?.click()}
                >
                  {uploadAvatar.isPending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Upload />
                  )}
                  Upload photo
                </Button>
                <p className="mt-2 text-[11px] text-brand-muted">JPG or PNG, up to 5 MB.</p>
              </div>
            </div>
          </Section>

          <form onSubmit={handleSave} className="space-y-6">
            <Section title="Producer details">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" value={form.full_name ?? ""} onChange={set("full_name")} />
                <Field
                  label="Title"
                  value={form.title ?? ""}
                  onChange={set("title")}
                  placeholder="Managing Producer"
                />
                <Field label="Agency" value={form.agency ?? ""} onChange={set("agency")} />
                <Field label="Phone" value={form.phone ?? ""} onChange={set("phone")} type="tel" />
                <Field
                  label="Resident license number"
                  value={form.license_number ?? ""}
                  onChange={set("license_number")}
                />
                <Field
                  label="National Producer Number"
                  value={form.npn ?? ""}
                  onChange={set("npn")}
                />
              </div>
              <div className="mt-4 space-y-1.5">
                <Label htmlFor="bio" className="text-xs">
                  Bio
                </Label>
                <Textarea
                  id="bio"
                  rows={4}
                  value={form.bio ?? ""}
                  onChange={(event) => setForm((prev) => ({ ...prev, bio: event.target.value }))}
                  placeholder="A short introduction clients see when you share materials."
                />
              </div>
            </Section>

            <Section
              title="Public records & links"
              description="Paste links to your public appointment and licensing records. SureLC has no public API, so link your SureLC producer page directly."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="SureLC profile URL"
                  value={form.surelc_url ?? ""}
                  onChange={set("surelc_url")}
                  placeholder="https://surelc.surancebay.com/..."
                  type="url"
                />
                <Field
                  label="NIPR / NAIC lookup URL"
                  value={form.nipr_url ?? ""}
                  onChange={set("nipr_url")}
                  placeholder="https://nipr.com/..."
                  type="url"
                />
                <Field
                  label="LinkedIn"
                  value={form.linkedin_url ?? ""}
                  onChange={set("linkedin_url")}
                  type="url"
                />
                <Field
                  label="Website"
                  value={form.website_url ?? ""}
                  onChange={set("website_url")}
                  type="url"
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  ["SureLC", form.surelc_url],
                  ["NIPR", form.nipr_url],
                  ["LinkedIn", form.linkedin_url],
                  ["Website", form.website_url],
                ]
                  .filter(([, url]) => Boolean(url))
                  .map(([label, url]) => (
                    <a
                      key={label}
                      href={url as string}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1.5 rounded-full bg-brand-surface px-3 py-1 text-[11px] font-medium text-brand-muted ring-1 ring-brand-border hover:text-brand-ink"
                    >
                      {label}
                      <ExternalLink className="size-3" />
                    </a>
                  ))}
              </div>
            </Section>

            <div className="flex justify-end">
              <Button type="submit" disabled={updateProfile.isPending || isLoading}>
                {updateProfile.isPending && <Loader2 className="animate-spin" />}
                Save profile
              </Button>
            </div>
          </form>
        </div>

        <Section
          title="State licenses"
          description="Track every appointment state, line of authority, and renewal date."
        >
          <form onSubmit={handleLicenseSubmit} className="grid gap-4 sm:grid-cols-2">
            <Field
              label="State"
              value={license.state}
              onChange={(value) => setLicense((p) => ({ ...p, state: value }))}
              placeholder="TX"
            />
            <Field
              label="License number"
              value={license.license_number}
              onChange={(value) => setLicense((p) => ({ ...p, license_number: value }))}
            />
            <Field
              label="Lines of authority"
              value={license.lines_of_authority}
              onChange={(value) => setLicense((p) => ({ ...p, lines_of_authority: value }))}
              placeholder="Life, Accident & Health"
            />
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Issued"
                type="date"
                value={license.issued_on}
                onChange={(value) => setLicense((p) => ({ ...p, issued_on: value }))}
              />
              <Field
                label="Expires"
                type="date"
                value={license.expires_on}
                onChange={(value) => setLicense((p) => ({ ...p, expires_on: value }))}
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-brand-muted">
              <Checkbox
                checked={license.is_active}
                onCheckedChange={(checked) =>
                  setLicense((p) => ({ ...p, is_active: checked === true }))
                }
              />
              Currently active
            </label>
            <div className="flex justify-end gap-2 sm:col-span-2">
              {editingId && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setEditingId(null);
                    setLicense(emptyLicense);
                  }}
                >
                  Cancel
                </Button>
              )}
              <Button type="submit" variant="outline" disabled={saveLicense.isPending}>
                <Plus />
                {editingId ? "Update license" : "Add license"}
              </Button>
            </div>
          </form>

          <ul className="mt-6 divide-y divide-brand-border border-t border-brand-border">
            {licenses.length === 0 && (
              <li className="py-6 text-center text-xs text-brand-muted">No licenses recorded yet.</li>
            )}
            {licenses.map((row) => (
              <li key={row.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {row.state} · {row.license_number}
                    {!row.is_active && (
                      <span className="ml-2 text-[10px] uppercase tracking-widest text-brand-muted">
                        Inactive
                      </span>
                    )}
                  </p>
                  <p className={cn("mt-0.5 text-[11px] text-brand-muted")}>
                    {row.lines_of_authority ?? "—"} · Expires {formatDate(row.expires_on)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditingId(row.id);
                    setLicense({
                      state: row.state,
                      license_number: row.license_number,
                      lines_of_authority: row.lines_of_authority ?? "",
                      issued_on: row.issued_on ?? "",
                      expires_on: row.expires_on ?? "",
                      is_active: row.is_active,
                    });
                  }}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${row.state} license`}
                  onClick={() =>
                    deleteLicense.mutate(row.id, {
                      onSuccess: () => toast.success("License removed"),
                    })
                  }
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </AppShell>
  );
}
