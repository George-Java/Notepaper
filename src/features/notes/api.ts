import { invoke } from "@tauri-apps/api/core";
import type { Note, NoteMetadata, SaveNoteRequest } from "./types";

export function listNotes(): Promise<NoteMetadata[]> {
  return invoke("notes_list");
}

export function getNote(id: string): Promise<Note> {
  return invoke("notes_get", { id });
}

export function createNote(request: SaveNoteRequest): Promise<Note> {
  return invoke("notes_create", { request });
}

export function updateNote(id: string, request: SaveNoteRequest): Promise<Note> {
  return invoke("notes_update", { id, request });
}

export function deleteNote(id: string): Promise<void> {
  return invoke("notes_delete", { id });
}

export function readExternalFile(path: string): Promise<string> {
  return invoke("read_external_file", { path });
}

export function saveExternalFile(path: string, content: string): Promise<void> {
  return invoke("save_external_file", { path, content });
}

export function getErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "操作失败";
}
