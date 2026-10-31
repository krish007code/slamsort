/** JSON-safe contracts only: no browser handles; optional text/name sharing requires consent. */
export type FileStatus =
  | 'discovered' | 'ready' | 'in-flight' | 'moving' | 'organized'
  | 'duplicate-kept' | 'skipped' | 'needs-recovery' | 'error';

export interface FileMetadata {
  id: string;
  name: string;
  relativePath: string;
  size: number;
  lastModified: number;
  mimeType: string;
  status: FileStatus;
  duplicateGroupId?: string;
}

export interface BucketNode {
  id: string;
  parentId: string | null;
  label: string;
  kind: 'category' | 'duplicates';
}

/** Omit names unless the user explicitly approves sharing them. */
export interface AiFileSummary {
  fileId: string;
  mimeType: string;
  size: number;
  approvedName?: string;
}

export interface FolderPlanRequest {
  sessionId: string;
  parentLabel?: string;
  requestId: string;
  parentId: string | null;
  prompt: string;
  files: readonly AiFileSummary[];
}

export interface FolderPlanResponse {
  sessionId: string;
  requestId: string;
  planId: string;
  parentId: string | null;
  /** Draft categories only: validate <= 5, unique IDs and safe single-segment labels. */
  categories: readonly BucketNode[];
  explanation: string;
}

export interface FileHintRequest {
  sessionId: string;
  approvedExcerpt?: string;
  requestId: string;
  planId: string;
  file: AiFileSummary;
  approvedBuckets: readonly BucketNode[];
}

export interface FileHintResponse {
  sessionId: string;
  planId: string;
  requestId: string;
  fileId: string;
  suggestedBucketId: string | null;
  explanation: string;
}

/** Intent is never proof of a successful filesystem operation. */
export type GameIntent =
  | { type: 'shot-released'; roundId: string; fileId: string; velocity: { x: number; y: number } }
  | { type: 'basket-entered'; roundId: string; fileId: string; bucketId: string }
  | { type: 'shot-missed'; roundId: string; fileId: string }
  | { type: 'inspection-requested' | 'hint-requested'; roundId: string; fileId: string };

export type FileOperationStage =
  | 'intent-recorded' | 'copying' | 'writer-closed' | 'destination-verified'
  | 'source-rechecked' | 'source-removed' | 'completed'
  | 'needs-recovery' | 'conflict' | 'failed';

export interface FileFingerprint {
  size: number;
  lastModified: number;
  sha256?: string;
}

/** Local journal, not an AI payload. Paths are relative to the selected root. */
export interface FileOperationJournalEntry {
  id: string;
  sessionId: string;
  fileId: string;
  kind: 'move' | 'undo';
  undoOf?: string;
  sourcePath: string;
  destinationPath: string;
  sourceBefore: FileFingerprint;
  destinationVerified?: FileFingerprint;
  stage: FileOperationStage;
  createdAt: string;
  updatedAt: string;
  error?: string;
}

export interface HealthResponse {
  status: 'ok';
  service: 'slamsort-api';
}

/** Public Firebase client metadata only. Never server credentials or ADC. */
export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  messagingSenderId?: string;
  storageBucket?: string;
}
export interface AiRuntimeConfig {
  mode: 'disabled' | 'local' | 'public';
  enabled: boolean;
  status: string;
  firebase?: FirebaseWebConfig;
  sessionToken?: string;
}
