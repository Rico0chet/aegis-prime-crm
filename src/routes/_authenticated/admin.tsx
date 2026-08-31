import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  QUESTION_INPUT_TYPES,
  optionsOf,
  questionTypeLabel,
  useCreateQuestion,
  useCreateTemplate,
  useDeleteQuestion,
  useDeleteTemplate,
  useIsAdmin,
  useProducers,
  useQuestions,
  useSetRole,
  useTemplates,
  useUpdateProducerProfile,
  useUpdateQuestion,
  useUpdateTemplate,
  type QuestionInputType,
  type QuestionRow,
} from "@/lib/admin";
import {
  CLIENT_STATUSES,
  POLICY_STATUSES,
  clientStatusLabel,
  formatCurrency,
  policyStatusLabel,
  useClients,
  usePolicies,
  useUpdateClient,
  useUpdatePolicyStatus,
  type ClientStatus,
  type PolicyStatus,
} from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin Portal | Aegis Prime Producer CRM" },
      {
        name: "description",
        content:
          "Administer producers, roles, client and policy records, and build needs-analysis question sets.",
      },
      { property: "og:title", content: "Admin Portal | Aegis Prime Producer CRM" },
      {
        property: "og:description",
        content:
          "Administer producers, roles, client and policy records, and build needs-analysis question sets.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { data: isAdmin, isLoading } = useIsAdmin();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && isAdmin === false) {
      toast.error("Admin access required");
      void navigate({ to: "/dashboard", replace: true });
    }
  }, [isAdmin, isLoading, navigate]);

  if (isLoading || !isAdmin) {
    return (
      <AppShell title="Admin Portal" eyebrow="Restricted area">
        <p className="text-sm text-brand-muted">
          {isLoading ? "Checking permissions…" : "You do not have admin access."}
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell title="Admin Portal" eyebrow="Full back-office control">
      <Tabs defaultValue="needs">
        <TabsList>
          <TabsTrigger value="needs">Needs Analysis</TabsTrigger>
          <TabsTrigger value="producers">Producers & Roles</TabsTrigger>
          <TabsTrigger value="records">Records</TabsTrigger>
        </TabsList>
        <TabsContent value="needs" className="mt-6">
          <NeedsAnalysisBuilder />
        </TabsContent>
        <TabsContent value="producers" className="mt-6">
          <ProducersPanel />
        </TabsContent>
        <TabsContent value="records" className="mt-6">
          <RecordsPanel />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-brand-border bg-brand-card p-5 shadow-brand-card sm:p-6">
      <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-muted">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

/* ------------------------------ needs analysis ------------------------------ */

function NeedsAnalysisBuilder() {
  const { data: templates = [] } = useTemplates();
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const deleteTemplate = useDeleteTemplate();

  const activeId = selectedId ?? templates[0]?.id;
  const activeTemplate = templates.find((t) => t.id === activeId);

  function handleCreateTemplate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    if (!name) return;
    createTemplate.mutate(
      {
        name,
        product_type: String(data.get("product_type") ?? "").trim() || null,
        description: String(data.get("description") ?? "").trim() || null,
      },
      {
        onSuccess: (template) => {
          toast.success("Template created");
          setSelectedId(template.id);
          form.reset();
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <div className="space-y-6">
        <Panel title="Templates">
          <div className="space-y-1">
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => setSelectedId(template.id)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-brand-surface ${
                  template.id === activeId ? "bg-brand-surface font-semibold" : "text-brand-muted"
                }`}
              >
                {template.name}
                <span className="ml-2 text-[10px] uppercase tracking-wide text-brand-muted">
                  {template.is_active ? "" : "inactive"}
                </span>
              </button>
            ))}
            {templates.length === 0 && (
              <p className="text-sm text-brand-muted">No templates yet.</p>
            )}
          </div>
        </Panel>

        <Panel title="New template">
          <form onSubmit={handleCreateTemplate} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required placeholder="Whole Life Discovery" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product_type">Product type</Label>
              <Input id="product_type" name="product_type" placeholder="Whole Life" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={2} />
            </div>
            <Button type="submit" className="w-full" disabled={createTemplate.isPending}>
              <Plus /> Add template
            </Button>
          </form>
        </Panel>
      </div>

      <div className="space-y-6">
        {activeTemplate ? (
          <>
            <Panel title="Template settings">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tpl-name">Name</Label>
                  <Input
                    id="tpl-name"
                    defaultValue={activeTemplate.name}
                    key={`${activeTemplate.id}-name`}
                    onBlur={(event) =>
                      event.target.value.trim() &&
                      event.target.value !== activeTemplate.name &&
                      updateTemplate.mutate({ id: activeTemplate.id, name: event.target.value.trim() })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tpl-product">Product type</Label>
                  <Input
                    id="tpl-product"
                    key={`${activeTemplate.id}-product`}
                    defaultValue={activeTemplate.product_type ?? ""}
                    onBlur={(event) =>
                      updateTemplate.mutate({
                        id: activeTemplate.id,
                        product_type: event.target.value.trim() || null,
                      })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tpl-desc">Description</Label>
                <Textarea
                  id="tpl-desc"
                  rows={2}
                  key={`${activeTemplate.id}-desc`}
                  defaultValue={activeTemplate.description ?? ""}
                  onBlur={(event) =>
                    updateTemplate.mutate({
                      id: activeTemplate.id,
                      description: event.target.value.trim() || null,
                    })
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={activeTemplate.is_active}
                    onCheckedChange={(is_active) =>
                      updateTemplate.mutate({ id: activeTemplate.id, is_active })
                    }
                    aria-label="Template active"
                  />
                  <span className="text-xs text-brand-muted">Available to producers</span>
                </div>
                <Button
                  variant="outline"
                  onClick={() =>
                    deleteTemplate.mutate(activeTemplate.id, {
                      onSuccess: () => {
                        toast.success("Template deleted");
                        setSelectedId(undefined);
                      },
                      onError: (error) => toast.error(error.message),
                    })
                  }
                >
                  <Trash2 /> Delete template
                </Button>
              </div>
            </Panel>

            <QuestionBuilder templateId={activeTemplate.id} />
          </>
        ) : (
          <Panel title="Questions">
            <p className="text-sm text-brand-muted">Create a template to start adding questions.</p>
          </Panel>
        )}
      </div>
    </div>
  );
}

function QuestionBuilder({ templateId }: { templateId: string }) {
  const { data: questions = [] } = useQuestions(templateId);
  const createQuestion = useCreateQuestion();
  const deleteQuestion = useDeleteQuestion();
  const updateQuestion = useUpdateQuestion();
  const [inputType, setInputType] = useState<QuestionInputType>("short_text");

  const needsOptions = inputType === "single_select" || inputType === "multi_select";

  function handleAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const prompt = String(data.get("prompt") ?? "").trim();
    if (!prompt) return;
    const options = String(data.get("options") ?? "")
      .split(",")
      .map((option) => option.trim())
      .filter(Boolean);
    createQuestion.mutate(
      {
        template_id: templateId,
        prompt,
        help_text: String(data.get("help_text") ?? "").trim() || null,
        input_type: inputType,
        options,
        is_required: data.get("is_required") === "on",
        sort_order: (questions[questions.length - 1]?.sort_order ?? 0) + 1,
      },
      {
        onSuccess: () => {
          toast.success("Question added");
          form.reset();
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  function move(question: QuestionRow, direction: -1 | 1) {
    const index = questions.findIndex((q) => q.id === question.id);
    const swap = questions[index + direction];
    if (!swap) return;
    updateQuestion.mutate({ id: question.id, sort_order: swap.sort_order });
    updateQuestion.mutate({ id: swap.id, sort_order: question.sort_order });
  }

  return (
    <Panel title={`Questions (${questions.length})`}>
      <div className="divide-y divide-brand-border rounded-lg border border-brand-border">
        {questions.map((question, index) => (
          <div key={question.id} className="flex items-start justify-between gap-4 p-4">
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-semibold">
                {index + 1}. {question.prompt}
                {question.is_required && <span className="ml-1 text-brand-accent">*</span>}
              </p>
              <p className="text-[11px] text-brand-muted">
                {questionTypeLabel[question.input_type]}
                {optionsOf(question).length > 0 && ` • ${optionsOf(question).join(", ")}`}
              </p>
              {question.help_text && (
                <p className="text-[11px] text-brand-muted">{question.help_text}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Move question up"
                disabled={index === 0}
                onClick={() => move(question, -1)}
              >
                ↑
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Move question down"
                disabled={index === questions.length - 1}
                onClick={() => move(question, 1)}
              >
                ↓
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove question ${question.prompt}`}
                onClick={() =>
                  deleteQuestion.mutate(question.id, {
                    onSuccess: () => toast.success("Question removed"),
                    onError: (error) => toast.error(error.message),
                  })
                }
              >
                <Trash2 className="size-4 text-brand-muted" />
              </Button>
            </div>
          </div>
        ))}
        {questions.length === 0 && (
          <p className="p-4 text-sm text-brand-muted">No questions in this template yet.</p>
        )}
      </div>

      <form onSubmit={handleAdd} className="space-y-3 rounded-lg border border-brand-border p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="prompt">Question</Label>
            <Input id="prompt" name="prompt" required placeholder="What is the client's retirement goal?" />
          </div>
          <div className="space-y-2">
            <Label>Answer type</Label>
            <Select value={inputType} onValueChange={(value) => setInputType(value as QuestionInputType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUESTION_INPUT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {questionTypeLabel[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="help_text">Helper text</Label>
            <Input id="help_text" name="help_text" />
          </div>
          {needsOptions && (
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="options">Choices (comma separated)</Label>
              <Input id="options" name="options" placeholder="Option A, Option B" />
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-4">
          <label className="flex items-center gap-2 text-xs text-brand-muted">
            <input type="checkbox" name="is_required" className="size-4 accent-current" /> Required
          </label>
          <Button type="submit" disabled={createQuestion.isPending}>
            <Plus /> Add question
          </Button>
        </div>
      </form>
    </Panel>
  );
}

/* -------------------------------- producers -------------------------------- */

function ProducersPanel() {
  const { data: producers = [], isLoading } = useProducers();
  const setRole = useSetRole();
  const updateProfile = useUpdateProducerProfile();

  return (
    <Panel title={`Producers (${producers.length})`}>
      <div className="divide-y divide-brand-border rounded-lg border border-brand-border">
        {producers.map((producer) => (
          <div key={producer.id} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="grid gap-3 sm:grid-cols-3">
              <Input
                aria-label="Full name"
                defaultValue={producer.full_name ?? ""}
                onBlur={(event) =>
                  updateProfile.mutate({ id: producer.id, full_name: event.target.value.trim() || null })
                }
              />
              <Input
                aria-label="Agency"
                placeholder="Agency"
                defaultValue={producer.agency ?? ""}
                onBlur={(event) =>
                  updateProfile.mutate({ id: producer.id, agency: event.target.value.trim() || null })
                }
              />
              <Input
                aria-label="License number"
                placeholder="License #"
                defaultValue={producer.license_number ?? ""}
                onBlur={(event) =>
                  updateProfile.mutate({
                    id: producer.id,
                    license_number: event.target.value.trim() || null,
                  })
                }
              />
            </div>
            <div className="flex items-center gap-2 justify-self-start sm:justify-self-end">
              <Switch
                checked={producer.roles.includes("admin")}
                aria-label={`Admin access for ${producer.full_name ?? "producer"}`}
                onCheckedChange={(grant) =>
                  setRole.mutate(
                    { userId: producer.id, role: "admin", grant },
                    {
                      onSuccess: () => toast.success(grant ? "Admin granted" : "Admin revoked"),
                      onError: (error) => toast.error(error.message),
                    },
                  )
                }
              />
              <span className="text-xs text-brand-muted">Admin</span>
            </div>
          </div>
        ))}
        {producers.length === 0 && (
          <p className="p-4 text-sm text-brand-muted">{isLoading ? "Loading…" : "No producers found."}</p>
        )}
      </div>
    </Panel>
  );
}

/* --------------------------------- records --------------------------------- */

function RecordsPanel() {
  const { data: clients = [] } = useClients();
  const { data: policies = [] } = usePolicies();
  const updateClient = useUpdateClient();
  const updatePolicyStatus = useUpdatePolicyStatus();

  return (
    <div className="space-y-6">
      <Panel title={`All clients (${clients.length})`}>
        <div className="divide-y divide-brand-border rounded-lg border border-brand-border">
          {clients.map((client) => (
            <div key={client.id} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="grid gap-3 sm:grid-cols-3">
                <Input
                  aria-label="First name"
                  defaultValue={client.first_name}
                  onBlur={(event) =>
                    event.target.value.trim() !== client.first_name &&
                    updateClient.mutate({ id: client.id, first_name: event.target.value.trim() })
                  }
                />
                <Input
                  aria-label="Last name"
                  defaultValue={client.last_name}
                  onBlur={(event) =>
                    event.target.value.trim() !== client.last_name &&
                    updateClient.mutate({ id: client.id, last_name: event.target.value.trim() })
                  }
                />
                <Input
                  aria-label="Email"
                  defaultValue={client.email ?? ""}
                  onBlur={(event) =>
                    updateClient.mutate({ id: client.id, email: event.target.value.trim() || null })
                  }
                />
              </div>
              <Select
                value={client.status}
                onValueChange={(value) =>
                  updateClient.mutate({ id: client.id, status: value as ClientStatus })
                }
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLIENT_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {clientStatusLabel[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
          {clients.length === 0 && <p className="p-4 text-sm text-brand-muted">No clients yet.</p>}
        </div>
      </Panel>

      <Panel title={`All policies (${policies.length})`}>
        <div className="divide-y divide-brand-border rounded-lg border border-brand-border">
          {policies.map((policy) => (
            <div key={policy.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {policy.carrier} — {policy.product_type}
                </p>
                <p className="text-[11px] text-brand-muted">
                  {policy.clients ? `${policy.clients.first_name} ${policy.clients.last_name}` : "Unassigned"} •{" "}
                  {formatCurrency(policy.annual_premium)} annual
                </p>
              </div>
              <Select
                value={policy.status}
                onValueChange={(value) =>
                  updatePolicyStatus.mutate({ id: policy.id, status: value as PolicyStatus })
                }
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POLICY_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {policyStatusLabel[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
          {policies.length === 0 && <p className="p-4 text-sm text-brand-muted">No policies yet.</p>}
        </div>
      </Panel>
    </div>
  );
}

function BillingPanel() {
  const { data: settings } = useBillingSettings();
  const { data: producers = [], isLoading } = useBillingProducers();
  const updateSettings = useUpdateBillingSettings();
  const updateAccount = useUpdateBillingAccount();

  const [basePrice, setBasePrice] = useState("");
  const [referralPercent, setReferralPercent] = useState("");
  const [trialDays, setTrialDays] = useState("");

  useEffect(() => {
    if (!settings) return;
    setBasePrice((settings.base_price_cents / 100).toFixed(2));
    setReferralPercent(String(settings.referral_discount_percent));
    setTrialDays(String(settings.trial_days));
  }, [settings]);

  return (
    <div className="space-y-6">
      <Panel title="Plan settings">
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <div>
            <Label htmlFor="base-price">Standard monthly price (USD)</Label>
            <Input
              id="base-price"
              value={basePrice}
              onChange={(event) => setBasePrice(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="referral-percent">Referral discount (%)</Label>
            <Input
              id="referral-percent"
              value={referralPercent}
              onChange={(event) => setReferralPercent(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="trial-days">Free trial length (days)</Label>
            <Input
              id="trial-days"
              value={trialDays}
              onChange={(event) => setTrialDays(event.target.value)}
            />
          </div>
        </div>
        <div className="border-t border-brand-border p-5">
          <Button
            onClick={() =>
              updateSettings.mutate(
                {
                  base_price_cents: Math.round(Number(basePrice || 0) * 100),
                  referral_discount_percent: Math.round(Number(referralPercent || 0)),
                  trial_days: Math.round(Number(trialDays || 0)),
                },
                {
                  onSuccess: () => toast.success("Plan settings saved"),
                  onError: (error) => toast.error(error.message),
                },
              )
            }
          >
            Save plan settings
          </Button>
          <p className="mt-2 text-xs text-brand-muted">
            Changing the standard price here updates what producers see. Ask your builder to update
            the checkout price to match.
          </p>
        </div>
      </Panel>

      <Panel title="Producer billing">
        {isLoading && <p className="p-5 text-sm text-brand-muted">Loading…</p>}
        <div className="divide-y divide-brand-border">
          {producers.map((producer) => (
            <ProducerBillingRow
              key={producer.user_id}
              producer={producer}
              basePriceCents={settings?.base_price_cents ?? 2000}
              referralPercent={settings?.referral_discount_percent ?? 0}
              onSave={(patch) =>
                updateAccount.mutate(
                  { userId: producer.user_id, ...patch },
                  {
                    onSuccess: () => toast.success("Billing updated"),
                    onError: (error) => toast.error(error.message),
                  },
                )
              }
            />
          ))}
          {!isLoading && producers.length === 0 && (
            <p className="p-5 text-sm text-brand-muted">No producers yet.</p>
          )}
        </div>
      </Panel>
    </div>
  );
}

function ProducerBillingRow({
  producer,
  basePriceCents,
  referralPercent,
  onSave,
}: {
  producer: BillingProducer;
  basePriceCents: number;
  referralPercent: number;
  onSave: (patch: {
    access_mode?: AccessMode;
    discount_percent?: number;
    custom_price_cents?: number | null;
    trial_ends_at?: string;
  }) => void;
}) {
  const [mode, setMode] = useState<AccessMode>(producer.access_mode as AccessMode);
  const [discount, setDiscount] = useState(String(producer.discount_percent));
  const [custom, setCustom] = useState(
    producer.custom_price_cents == null ? "" : (producer.custom_price_cents / 100).toFixed(2),
  );

  const effective = effectivePriceCents(
    {
      access_mode: mode,
      discount_percent: Number(discount || 0),
      custom_price_cents: custom === "" ? null : Math.round(Number(custom) * 100),
      referred_by: producer.referred_by,
    },
    { base_price_cents: basePriceCents, referral_discount_percent: referralPercent },
  );

  return (
    <div className="grid gap-3 p-5 lg:grid-cols-[1.4fr_repeat(3,1fr)_auto] lg:items-end">
      <div>
        <p className="text-sm font-semibold">{producer.full_name ?? "Unnamed producer"}</p>
        <p className="text-xs text-brand-muted">
          {producer.agency ?? "—"} · code {producer.referral_code} · {producer.referral_count}{" "}
          referral{producer.referral_count === 1 ? "" : "s"}
          {producer.referred_by_code ? ` · referred by ${producer.referred_by_code}` : ""}
        </p>
        <p className="mt-1 text-xs text-brand-muted">
          Plan status: {producer.subscription_status ?? "no paid plan"} · charged{" "}
          {formatMoney(effective)}/mo
        </p>
      </div>

      <div>
        <Label>Access</Label>
        <Select value={mode} onValueChange={(value) => setMode(value as AccessMode)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="trial">Trial</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="free">Free (comped)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Discount %</Label>
        <Input value={discount} onChange={(event) => setDiscount(event.target.value)} />
      </div>

      <div>
        <Label>Custom price (USD)</Label>
        <Input
          value={custom}
          placeholder="—"
          onChange={(event) => setCustom(event.target.value)}
        />
      </div>

      <Button
        variant="outline"
        onClick={() =>
          onSave({
            access_mode: mode,
            discount_percent: Math.max(0, Math.min(100, Math.round(Number(discount || 0)))),
            custom_price_cents: custom === "" ? null : Math.round(Number(custom) * 100),
          })
        }
      >
        Save
      </Button>
    </div>
  );
}
