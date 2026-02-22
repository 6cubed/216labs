"use client";

import { useEffect, useState } from "react";
import { Key, Plus, Trash2, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface StoredKey {
  id: string;
  provider: string;
  label: string;
  maskedKey: string;
  createdAt: string;
}

export default function SettingsPage() {
  const [keys, setKeys] = useState<StoredKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadKeys();
  }, []);

  async function loadKeys() {
    try {
      const res = await fetch("/api/settings/api-keys");
      if (res.ok) setKeys(await res.json());
    } catch {
      toast.error("Failed to load API keys");
    } finally {
      setLoading(false);
    }
  }

  async function saveKey() {
    if (!newKey.trim()) {
      toast.error("Please enter an API key");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: newKey.trim(),
          provider: "openai",
          label: newLabel.trim() || "Default",
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || "Failed to save API key");
        return;
      }

      toast.success("API key saved successfully");
      setNewKey("");
      setNewLabel("");
      loadKeys();
    } catch {
      toast.error("Failed to save API key");
    } finally {
      setSaving(false);
    }
  }

  async function deleteKey(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/settings/api-keys?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("API key deleted");
        loadKeys();
      }
    } catch {
      toast.error("Failed to delete API key");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your API keys and account settings.
        </p>
      </div>

      <div className="space-y-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Key className="h-5 w-5" />
              OpenAI API Key
            </CardTitle>
            <CardDescription>
              Add your OpenAI API key to enable AI-powered vulnerability
              analysis. Your key is encrypted at rest and only used during scans
              of your repositories.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="label">Label (optional)</Label>
              <Input
                id="label"
                placeholder="e.g., Production Key"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <div className="relative">
                <Input
                  id="apiKey"
                  type={showKey ? "text" : "password"}
                  placeholder="sk-..."
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <Button onClick={saveKey} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Add Key
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Stored Keys</CardTitle>
            <CardDescription>
              Your encrypted API keys. Only the masked version is shown.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : keys.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                No API keys configured. Add one above to enable AI-powered
                scanning.
              </p>
            ) : (
              <div className="space-y-3">
                {keys.map((key) => (
                  <div
                    key={key.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border/50"
                  >
                    <div className="flex items-center gap-3">
                      <Key className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{key.label}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <code className="text-xs text-muted-foreground">
                            {key.maskedKey}
                          </code>
                          <Badge variant="secondary" className="text-xs">
                            {key.provider}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteKey(key.id)}
                      disabled={deletingId === key.id}
                    >
                      {deletingId === key.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
