"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  Check,
  Edit3,
  Hash,
  Plus,
  Power,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  createHashtagAction,
  deleteHashtagAction,
  setHashtagActiveAction,
  updateHashtagAction,
} from "@/app/admin/actions";
import PanelHeading from "@/components/dashboard/PanelHeading";
import { formatDateTime } from "@/lib/format-date";
import type { ActionResult, SocialHashtag } from "@/types";

type StatusFilter = "all" | "active" | "inactive";

interface HashtagManagerProps {
  initialHashtags: SocialHashtag[];
  loadError?: string;
  previewMode?: boolean;
}

export default function HashtagManager({
  initialHashtags,
  loadError,
  previewMode = false,
}: HashtagManagerProps) {
  const [hashtags, setHashtags] = useState(initialHashtags);
  const [newValue, setNewValue] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [busy, setBusy] = useState(false);
  const [hashtagToDelete, setHashtagToDelete] = useState<SocialHashtag | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; error: boolean } | null>(null);

  const filteredHashtags = useMemo(() => {
    const query = search.trim().toLowerCase();
    return hashtags.filter((hashtag) => {
      const matchesSearch = !query || hashtag.hashtag.toLowerCase().includes(query);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" ? hashtag.isActive : !hashtag.isActive);
      return matchesSearch && matchesStatus;
    });
  }, [hashtags, search, statusFilter]);

  const activeCount = hashtags.filter((hashtag) => hashtag.isActive).length;
  const inactiveCount = hashtags.length - activeCount;

  async function runAction<T>(
    action: () => Promise<ActionResult<T>>,
    onSuccess: (value: T) => void,
  ) {
    if (previewMode) {
      setFeedback({
        message: "Hashtag changes are disabled in Developer Preview.",
        error: true,
      });
      return;
    }

    setBusy(true);
    setFeedback(null);
    try {
      const result = await action();
      if (result.success) onSuccess(result.data);
      setFeedback({ message: result.message, error: !result.success });
    } catch (error) {
      console.error("[admin dashboard] Hashtag request failed:", error);
      setFeedback({ message: "The hashtag request could not be completed. Try again.", error: true });
    } finally {
      setBusy(false);
    }
  }

  async function addHashtag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction(() => createHashtagAction(newValue), (created) => {
      setHashtags((current) => [created, ...current]);
      setNewValue("");
      setSearch("");
      setStatusFilter("all");
    });
  }

  async function saveEdit(id: string) {
    await runAction(
      () => updateHashtagAction(id, editingValue),
      (updated) => {
        setHashtags((current) =>
          current.map((hashtag) => (hashtag.id === id ? updated : hashtag)),
        );
        setEditingId(null);
      },
    );
  }

  async function toggleActive(hashtag: SocialHashtag) {
    await runAction(
      () => setHashtagActiveAction(hashtag.id, !hashtag.isActive),
      (updated) => {
        setHashtags((current) =>
          current.map((item) => (item.id === hashtag.id ? updated : item)),
        );
      },
    );
  }

  async function confirmDelete() {
    if (!hashtagToDelete) return;
    const target = hashtagToDelete;
    await runAction(() => deleteHashtagAction(target.id), () => {
      setHashtags((current) => current.filter((item) => item.id !== target.id));
      setHashtagToDelete(null);
    });
  }

  const emptyMessage =
    previewMode
      ? "No real hashtags are loaded in Developer Preview."
      : loadError
      ? "Hashtag records are unavailable."
      : hashtags.length === 0
      ? "No hashtags have been added to this workspace yet."
      : "No hashtags match your search and status filter.";

  return (
    <>
      <section className="content-panel hashtag-manager" aria-label="Hashtag manager" aria-busy={busy}>
        <PanelHeading
          title="Hashtag manager"
          description="Manage the tags used to discover social posts."
          action={
            <>
              <span className="submissions-total">
                {previewMode ? "Developer Preview" : `${hashtags.length} total`}
              </span>
              <button
                type="button"
                className="primary-button hashtag-add-trigger"
                disabled={!previewMode && Boolean(loadError)}
                onClick={() => setAddDialogOpen(true)}
              >
                <Plus size={14} aria-hidden="true" />
                Add hashtag
              </button>
            </>
          }
        />

        {previewMode ? (
          <p className="preview-inline-notice" role="status">
            This local preview does not load or change protected hashtag records.
          </p>
        ) : loadError ? (
          <p className="inline-error" role="alert">{loadError}</p>
        ) : null}

        {feedback && !hashtagToDelete && (
          <p
            className={feedback.error ? "inline-error" : "inline-success"}
            role={feedback.error ? "alert" : "status"}
          >
            {feedback.message}
          </p>
        )}

        <div className="hashtag-toolbar">
          <label className="hashtag-search" htmlFor="hashtag-search">
            <Search size={15} aria-hidden="true" />
            <input
              id="hashtag-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search hashtags"
              aria-label="Search hashtags"
            />
          </label>
          <div className="hashtag-filter">
            <label htmlFor="hashtag-status-filter">Status</label>
            <select
              id="hashtag-status-filter"
              value={statusFilter}
              onChange={(event) => {
                const value = event.target.value;
                if (value === "all" || value === "active" || value === "inactive") {
                  setStatusFilter(value);
                }
              }}
            >
              <option value="all">All ({hashtags.length})</option>
              <option value="active">Active ({activeCount})</option>
              <option value="inactive">Inactive ({inactiveCount})</option>
            </select>
          </div>
          <span className="hashtag-result-count" aria-live="polite">
            {filteredHashtags.length} shown
          </span>
        </div>

        <div className="table-scroll hashtag-table-scroll">
          <table className="submissions-table hashtag-table">
            <thead>
              <tr>
                <th scope="col">Hashtag</th>
                <th scope="col">Status</th>
                <th scope="col">Created</th>
                <th scope="col" className="hashtag-action-column">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredHashtags.map((hashtag) => (
                <tr key={hashtag.id}>
                  <td>
                    <div className="hashtag-table-name">
                      <span className="hashtag-symbol"><Hash size={15} aria-hidden="true" /></span>
                      {editingId === hashtag.id ? (
                        <input
                          className="hashtag-edit-input"
                          aria-label={`Edit ${hashtag.hashtag}`}
                          maxLength={100}
                          value={editingValue}
                          onChange={(event) => setEditingValue(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void saveEdit(hashtag.id);
                            } else if (event.key === "Escape") {
                              setEditingId(null);
                              setEditingValue("");
                            }
                          }}
                          disabled={busy}
                          autoFocus
                        />
                      ) : (
                        <strong>{hashtag.hashtag}</strong>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className={`tag-state ${hashtag.isActive ? "active" : "inactive"}`}>
                      <span aria-hidden="true" />
                      {hashtag.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="date-cell">{formatDateTime(hashtag.createdAt)}</td>
                  <td className="hashtag-action-column">
                    <div className="hashtag-actions">
                      {editingId === hashtag.id ? (
                        <>
                          <button
                            type="button"
                            className="icon-button small"
                            title="Save hashtag"
                            aria-label="Save hashtag"
                            disabled={busy}
                            onClick={() => void saveEdit(hashtag.id)}
                          >
                            <Check size={15} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="icon-button small"
                            title="Cancel edit"
                            aria-label="Cancel edit"
                            disabled={busy}
                            onClick={() => {
                              setEditingId(null);
                              setEditingValue("");
                            }}
                          >
                            <X size={15} aria-hidden="true" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="icon-button small"
                            title={`Edit ${hashtag.hashtag}`}
                            aria-label={`Edit ${hashtag.hashtag}`}
                            disabled={busy || Boolean(loadError)}
                            onClick={() => {
                              setEditingId(hashtag.id);
                              setEditingValue(hashtag.hashtag);
                            }}
                          >
                            <Edit3 size={15} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="icon-button small"
                            title={hashtag.isActive ? "Deactivate hashtag" : "Activate hashtag"}
                            aria-label={hashtag.isActive ? "Deactivate hashtag" : "Activate hashtag"}
                            disabled={busy || Boolean(loadError)}
                            onClick={() => void toggleActive(hashtag)}
                          >
                            <Power size={15} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="icon-button small destructive"
                            title={`Delete ${hashtag.hashtag}`}
                            aria-label={`Delete ${hashtag.hashtag}`}
                            disabled={busy || Boolean(loadError)}
                            onClick={() => {
                              setFeedback(null);
                              setHashtagToDelete(hashtag);
                            }}
                          >
                            <Trash2 size={15} aria-hidden="true" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredHashtags.length === 0 && (
                <tr>
                  <td colSpan={4} className="hashtag-empty-cell">
                    <span className="empty-icon"><Hash size={18} aria-hidden="true" /></span>
                    <strong>{emptyMessage}</strong>
                    {previewMode ? (
                      <div className="hashtag-preview-actions">
                        <button type="button" className="icon-button small" disabled>
                          <Edit3 size={14} aria-hidden="true" />
                          Edit
                        </button>
                        <button type="button" className="icon-button small" disabled>
                          <Power size={14} aria-hidden="true" />
                          Deactivate
                        </button>
                        <span>Controls are placeholders until a real hashtag record is loaded.</span>
                      </div>
                    ) : hashtags.length === 0 && !loadError ? (
                      <span>Add a hashtag above to begin organizing posts.</span>
                    ) : null}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="table-footnote">
          Deleting a hashtag linked to posts may be prevented by the database. Deactivate it instead.
        </div>
      </section>

      {addDialogOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) setAddDialogOpen(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape" && !busy) setAddDialogOpen(false);
          }}
        >
          <section
            className="integration-dialog hashtag-form-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-hashtag-title"
            aria-describedby="add-hashtag-description"
          >
            <button
              type="button"
              className="icon-button dialog-close"
              aria-label="Close add hashtag dialog"
              disabled={busy}
              onClick={() => setAddDialogOpen(false)}
            >
              <X size={18} aria-hidden="true" />
            </button>
            <span className="hashtag-dialog-icon"><Hash size={19} aria-hidden="true" /></span>
            <h2 id="add-hashtag-title">Add a hashtag</h2>
            <p id="add-hashtag-description">
              {previewMode
                ? "This form is for visual testing only. No hashtag will be created."
                : "Add a tag to organize incoming social posts."}
            </p>
            <form className="hashtag-dialog-form" onSubmit={addHashtag}>
              <label htmlFor="new-hashtag">Hashtag</label>
              <input
                id="new-hashtag"
                type="text"
                maxLength={100}
                value={newValue}
                onChange={(event) => setNewValue(event.target.value)}
                placeholder="#your-brand-tag"
                required
                disabled={busy || (!previewMode && Boolean(loadError))}
              />
              {previewMode && (
                <p className="preview-inline-notice">
                  Saving is disabled while Developer Preview is active.
                </p>
              )}
              {feedback && (
                <p
                  className={feedback.error ? "inline-error" : "inline-success"}
                  role={feedback.error ? "alert" : "status"}
                >
                  {feedback.message}
                </p>
              )}
              <div className="hashtag-dialog-actions">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => setAddDialogOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={busy || previewMode || Boolean(loadError)}
                >
                  <Plus size={14} aria-hidden="true" />
                  {previewMode ? "Preview only" : busy ? "Saving…" : "Add hashtag"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {hashtagToDelete && (
        <div
          className="modal-backdrop"
          onKeyDown={(event) => {
            if (event.key === "Escape" && !busy) setHashtagToDelete(null);
          }}
        >
          <section
            className="integration-dialog hashtag-delete-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-hashtag-title"
            aria-describedby="delete-hashtag-description"
          >
            <span className="delete-warning-icon"><Trash2 size={19} aria-hidden="true" /></span>
            <h2 id="delete-hashtag-title">Delete {hashtagToDelete.hashtag}?</h2>
            <p id="delete-hashtag-description">
              This action cannot be undone. If posts still reference this hashtag, the database will
              prevent deletion.
            </p>
            {feedback?.error && <p className="inline-error" role="alert">{feedback.message}</p>}
            <div className="hashtag-delete-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={busy}
                autoFocus
                onClick={() => setHashtagToDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="danger-button"
                disabled={busy}
                onClick={() => void confirmDelete()}
              >
                <Trash2 size={14} aria-hidden="true" />
                {busy ? "Deleting…" : "Delete hashtag"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
