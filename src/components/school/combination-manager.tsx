"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Edit2 } from "lucide-react";

interface Combination {
  id: string;
  name: string;
  shortName: string | null;
  stream: string;
  aliases: Array<{ id: string; alias: string; normalizedAlias: string }>;
}

interface CombinationManagerProps {
  schoolId: string;
}

export function CombinationManager({ schoolId }: CombinationManagerProps) {
  const router = useRouter();
  const [combinations, setCombinations] = useState<Combination[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [stream, setStream] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editShortName, setEditShortName] = useState("");
  const [editStream, setEditStream] = useState("");
  const [saving, startTransition] = useTransition();
  const [aliasInputs, setAliasInputs] = useState<Record<string, string>>({});

  async function loadCombinations() {
    try {
      const res = await fetch(`/api/admin/combination?schoolId=${schoolId}`);
      if (res.ok) {
        const data = await res.json();
        setCombinations(data);
      }
    } catch {
      toast.error("Failed to load combinations");
    } finally {
      setLoading(false);
    }
  }

  async function createCombination() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/admin/combination?schoolId=${schoolId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, shortName: shortName || undefined, stream: stream || undefined }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to create");
      toast.success("Combination created");
      setName("");
      setShortName("");
      setStream("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create combination");
    } finally {
      setCreating(false);
    }
  }

  async function updateCombination(id: string) {
    const combo = combinations.find(c => c.id === id);
    if (!combo) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/combination/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: editName, shortName: editShortName || undefined, stream: editStream || undefined }),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "Failed to update");
        toast.success("Combination updated");
        setEditingId(null);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to update combination");
      }
    });
  }

  async function deleteCombination(id: string) {
    if (!confirm("Delete this combination? This cannot be undone.")) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/combination/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "Failed to delete");
        toast.success("Combination deleted");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to delete combination");
      }
    });
  }

  async function addAlias(combinationId: string) {
    const alias = aliasInputs[combinationId];
    if (!alias?.trim()) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/combination/${combinationId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ alias }),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "Failed to add alias");
        toast.success("Alias added");
        setAliasInputs(prev => ({ ...prev, [combinationId]: "" }));
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to add alias");
      }
    });
  }

  async function deleteAlias(combinationId: string, aliasId: string) {
    if (!confirm("Delete this alias?")) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/combination/${combinationId}/alias/${aliasId}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "Failed to delete alias");
        toast.success("Alias deleted");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to delete alias");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Combination & Alias Management
        </CardTitle>
        <CardDescription>
          Define academic streams and their import aliases. Aliases match workbook combination names.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="combo-name">Name</Label>
            <Input
              id="combo-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Mathematics & Science"
              disabled={creating}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="combo-short">Short name</Label>
            <Input
              id="combo-short"
              value={shortName}
              onChange={(e) => setShortName(e.target.value)}
              placeholder="Auto from name"
              maxLength={20}
              disabled={creating}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="combo-stream">Stream</Label>
            <Input
              id="combo-stream"
              value={stream}
              onChange={(e) => setStream(e.target.value)}
              placeholder="e.g., STEM, Arts, Commerce"
              disabled={creating}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="combo-create">&nbsp;</Label>
            <Button onClick={createCombination} disabled={creating || !name.trim()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add combination"}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : combinations.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No combinations defined yet.</p>
        ) : (
          <div className="space-y-4">
            {combinations.map((combo) => (
              <div key={combo.id} className="rounded-lg border border-border p-4">
                {editingId === combo.id ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor={`edit-name-${combo.id}`}>Name</Label>
                        <Input
                          id={`edit-name-${combo.id}`}
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          disabled={saving}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`edit-short-${combo.id}`}>Short name</Label>
                        <Input
                          id={`edit-short-${combo.id}`}
                          value={editShortName}
                          onChange={(e) => setEditShortName(e.target.value)}
                          maxLength={20}
                          disabled={saving}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`edit-stream-${combo.id}`}>Stream</Label>
                        <Input
                          id={`edit-stream-${combo.id}`}
                          value={editStream}
                          onChange={(e) => setEditStream(e.target.value)}
                          disabled={saving}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => updateCombination(combo.id)} disabled={saving}>
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                      </Button>
                      <Button variant="outline" onClick={() => setEditingId(null)} disabled={saving}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
                      <div>
                        <p className="font-medium">{combo.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {combo.shortName && <span className="mr-2 font-mono">{combo.shortName}</span>}
                          {combo.stream && <span className="mr-2">· {combo.stream}</span>}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => {
                          setEditingId(combo.id);
                          setEditName(combo.name);
                          setEditShortName(combo.shortName ?? "");
                          setEditStream(combo.stream ?? "");
                        }}>
                          <Edit2 className="h-4 w-4 mr-1" /> Edit
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => deleteCombination(combo.id)}>
                          <Trash2 className="h-4 w-4 mr-1" /> Delete
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Aliases</p>
                      {combo.aliases.length === 0 && (
                        <p className="text-sm text-muted-foreground">No aliases defined.</p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {combo.aliases.map((alias) => (
                          <Badge key={alias.id} variant="outline" className="flex items-center gap-1">
                            {alias.alias}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 p-0"
                              onClick={() => deleteAlias(combo.id, alias.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </Badge>
                        ))}
                        <div className="flex gap-2">
                          <Input
                            value={aliasInputs[combo.id] ?? ""}
                            onChange={(e) => setAliasInputs(prev => ({ ...prev, [combo.id]: e.target.value }))}
                            placeholder="Add alias..."
                            className="max-w-xs"
                          />
                          <Button size="sm" onClick={() => addAlias(combo.id)}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}