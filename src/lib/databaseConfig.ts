import config from '../../firebase-applet-config.json';
/** Preserve the configured identity: "default" is a named DB, not "(default)". */
export const FIRESTORE_DATABASE_ID = String(config.firestoreDatabaseId || '(default)');
export const STORAGE_DIRECT_ACCESS_SUPPORTED = FIRESTORE_DATABASE_ID === '(default)';
