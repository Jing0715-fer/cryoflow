"use client";

/**
 * CryoFlow — "Run on cluster" control (job panel action row).
 *
 * The dispatch face of the remote layer: pick a saved SSH connection +
 * the relion module it should load, and the job is POSTed to
 * /api/jobs/[id]/run with { remote: target } — the store's runJobRemote
 * owns the response dialect (busy kinds, waiting/staging, honest
 * failures). Mode is deliberately NOT exposed: the remote engine runs
 * direct (nohup) today, so a choice would be a promise the backend
 * doesn't keep yet.
 *
 * Defaults come from the cluster manager's ACTIVE connection
 * (localStorage "cryoflow.remote.active"); modules from that
 * connection's last probe. No connections yet? The dialog offers the
 * manager instead of a dead select.
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  onEscapeClose,
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Server } from "lucide-react";
import { useWorkflowStore } from "@/lib/store";
import type { JobDTO } from "@/lib/types";
import type { RemoteRunTarget } from "@/lib/remote/types";
import {
  RemoteClusterDialog,
  readActiveRemoteConnectionId,
  useRemoteConnections,
} from "./remote-cluster-dialog";

export function RemoteRunButton({ job }: { job: JobDTO }) {
  const [open, setOpen] = React.useState(false);
  const { connections, reload } = useRemoteConnections(open);
  const runJobRemote = useWorkflowStore((s) => s.runJobRemote);

  const [connId, setConnId] = React.useState("");
  const [module, setModule] = React.useState("");
  const [pending, setPending] = React.useState(false);
  // the nested cluster manager (empty state → add a connection right here)
  const [clusterOpen, setClusterOpen] = React.useState(false);

  const conn = connections.find((c) => c.id === connId) ?? null;
  const probedModules = conn?.lastProbe?.relionModules ?? [];

  // default connection: keep the current pick, else the ACTIVE one, else first
  React.useEffect(() => {
    if (!open) return;
    setConnId((prev) => {
      if (prev && connections.some((c) => c.id === prev)) return prev;
      const active = readActiveRemoteConnectionId();
      if (active && connections.some((c) => c.id === active)) return active;
      return connections[0]?.id ?? "";
    });
  }, [open, connections]);

  // module default follows the connection (its defaultModule, else first probed)
  React.useEffect(() => {
    if (!conn) {
      setModule("");
      return;
    }
    const probed = conn.lastProbe?.relionModules ?? [];
    if (conn.defaultModule && probed.includes(conn.defaultModule)) setModule(conn.defaultModule);
    else setModule(probed[0] ?? conn.defaultModule ?? "");
  }, [conn]);

  const disabled = job.status === "running" || job.linkedJobId != null;

  const submit = async () => {
    if (!conn || pending) return;
    setPending(true);
    try {
      const target: RemoteRunTarget = {
        connectionId: conn.id,
        module: module || null,
        mode: "direct",
      };
      const ok = await runJobRemote(job.id, target);
      if (ok) setOpen(false);
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative size-8 shrink-0 text-muted-foreground hover:text-foreground before:absolute before:-inset-1.5 before:rounded-md before:content-['']"
          disabled={disabled}
          aria-label="Run on cluster (SSH)"
          title={
            job.linkedJobId != null
              ? "Linked copies mirror their original — run the original job instead"
              : "Run on cluster (SSH)"
          }
        >
          <Server className="size-4" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-lg"
        onKeyDown={onEscapeClose(() => setOpen(false))}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="size-4 text-primary" aria-hidden="true" />
            Run on cluster · {job.name}
          </DialogTitle>
          <DialogDescription>
            Dispatch this job over SSH — inputs are staged to the cluster, the chosen
            relion module is loaded, and outputs sync back when it finishes.
          </DialogDescription>
        </DialogHeader>

        {connections.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-md border border-dashed px-4 py-8 text-center">
            <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Server className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-medium">No cluster connections yet</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                Add an SSH login node (host, user, password or key), probe it for relion
                modules, then come back.
              </p>
            </div>
            <Button variant="outline" size="sm" className="h-9 text-sm" onClick={() => setClusterOpen(true)}>
              Manage clusters
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground">Connection</p>
                <Select
                  value={connId}
                  onValueChange={(v) => {
                    setConnId(v);
                    setModule("");
                  }}
                >
                  <SelectTrigger className="h-9 text-sm" aria-label="Cluster connection">
                    <SelectValue placeholder="Cluster connection" />
                  </SelectTrigger>
                  <SelectContent>
                    {connections.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span
                            className={
                              c.lastProbe?.ok
                                ? "size-1.5 shrink-0 rounded-full bg-emerald-500"
                                : c.lastProbe
                                  ? "size-1.5 shrink-0 rounded-full bg-rose-500"
                                  : "size-1.5 shrink-0 rounded-full bg-slate-400 dark:bg-slate-500"
                            }
                            aria-hidden="true"
                          />
                          <span className="max-w-[220px] truncate">{c.name || `${c.username}@${c.host}`}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground">relion module</p>
                {probedModules.length > 0 ? (
                  <Select value={module} onValueChange={setModule}>
                    <SelectTrigger className="h-9 font-mono text-[13px]" aria-label="relion module to load">
                      <SelectValue placeholder="module" />
                    </SelectTrigger>
                    <SelectContent>
                      {probedModules.map((m) => (
                        <SelectItem key={m} value={m} className="font-mono text-xs">
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <>
                    <div
                      className="flex h-9 items-center rounded-md border bg-muted/40 px-2 text-[13px] text-muted-foreground"
                      aria-label="relion module — not probed yet"
                    >
                      not probed
                    </div>
                    <p className="text-[10px] leading-snug text-amber-600 dark:text-amber-400">
                      module not probed — Test the connection first (Remote clusters in the top bar).
                    </p>
                  </>
                )}
              </div>

              {conn ? (
                <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="font-mono">
                    {conn.username}@{conn.host}
                  </span>
                  <span aria-hidden="true">·</span>
                  {module ? (
                    <Badge variant="outline" className="h-4 px-1 font-mono text-[9.5px] text-foreground/80">
                      module {module}
                    </Badge>
                  ) : (
                    <span>no module</span>
                  )}
                  <span aria-hidden="true">·</span>
                  <span>runs direct (no scheduler)</span>
                </p>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" className="h-9 text-sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-9 gap-1.5 text-sm"
                onClick={() => void submit()}
                disabled={pending || !conn}
              >
                {pending ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Server className="size-3.5" aria-hidden="true" />
                )}
                {pending ? "Sending…" : "Send to cluster"}
              </Button>
            </div>
          </>
        )}

        {/* empty-state deep link: the manager floats on top of this dialog */}
        <RemoteClusterDialog
          open={clusterOpen}
          onOpenChange={(v) => {
            setClusterOpen(v);
            if (!v) reload(); // a connection may have just been created/probed
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
