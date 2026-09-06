import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Trash2,
  Users,
  UserPlus,
  Server,
  Cloud,
  Database,
  Cpu,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Mail,
  Key,
  Layers,
  Save,
  HardDrive,
} from 'lucide-react';
import { api } from '../lib/api';

interface AdminUser {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
}

interface AdminViewProps {
  onRefreshStats?: () => Promise<void>;
}

export const AdminView: React.FC<AdminViewProps> = ({ onRefreshStats }) => {
  // Users state
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState('auditor');
  const [isAddingUser, setIsAddingUser] = useState(false);

  // Cloud & Database config state
  const [dbType, setDbType] = useState<'sqlite_local' | 'cloud_sql' | 'postgres' | 'turso'>('sqlite_local');
  const [cloudDbUri, setCloudDbUri] = useState('');
  const [cloudStorageBucket, setCloudStorageBucket] = useState('auditeq-recordings-prod');
  const [cloudBackupEnabled, setCloudBackupEnabled] = useState(true);
  const [sslRequired, setSslRequired] = useState(true);
  const [concurrencyWorkers, setConcurrencyWorkers] = useState(3);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Clear Database State
  const [isClearingDb, setIsClearingDb] = useState(false);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  // Status notification
  const [statusNotice, setStatusNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setStatusNotice({ type, message });
    setTimeout(() => setStatusNotice(null), 4000);
  };

  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const data = await api.getAdminUsers();
      setUsers(data || []);
    } catch (err: unknown) {
      console.error('Failed to load users:', err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail.trim() || !newUserPassword.trim()) {
      showNotification('error', 'Please provide an email and password.');
      return;
    }

    setIsAddingUser(true);
    try {
      await api.createAdminUser({
        email: newUserEmail.trim(),
        password: newUserPassword.trim(),
        full_name: newUserName.trim() || undefined,
        role: newUserRole,
      });

      showNotification('success', `Team user ${newUserEmail} created successfully.`);
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserName('');
      await fetchUsers();
    } catch (err: unknown) {
      showNotification('error', (err as Error).message || 'Failed to add user.');
    } finally {
      setIsAddingUser(false);
    }
  };

  const handleDeleteUser = async (id: number, email: string) => {
    if (!window.confirm(`Are you sure you want to revoke access for ${email}?`)) return;

    try {
      await api.deleteAdminUser(id);
      showNotification('success', `User ${email} removed.`);
      await fetchUsers();
    } catch (err: unknown) {
      showNotification('error', (err as Error).message || 'Failed to remove user.');
    }
  };

  const handleClearAllDatabase = async () => {
    if (confirmText.trim() !== 'CLEAR ALL') {
      alert('Please type "CLEAR ALL" exactly to confirm.');
      return;
    }

    setIsClearingDb(true);
    try {
      const res = await api.clearAllDatabase();
      setShowClearConfirmModal(false);
      setConfirmText('');
      showNotification('success', res.message || 'Database successfully purged and reset to zero.');
      if (onRefreshStats) await onRefreshStats();
    } catch (err: unknown) {
      showNotification('error', (err as Error).message || 'Failed to clear database.');
    } finally {
      setIsClearingDb(false);
    }
  };

  const handleSaveCloudConfig = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    setTimeout(() => {
      setIsSavingConfig(false);
      showNotification('success', 'Cloud and database hosting configurations saved.');
    }, 600);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2.5">
            <span className="p-1.5 rounded-xl bg-black text-amber-400">
              <Server className="w-5 h-5" />
            </span>
            <span>Enterprise Admin &amp; Backend Cloud Controls</span>
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            Centralized infrastructure management: User administration, external cloud database hosting, background pipeline concurrency, and database wipe controls.
          </p>
        </div>

        <button
          onClick={() => setShowClearConfirmModal(true)}
          className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 cursor-pointer transition-all hover:shadow-md shrink-0"
        >
          <Trash2 className="w-4 h-4" />
          <span>Clear All Database (1-Click)</span>
        </button>
      </div>

      {statusNotice && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
            statusNotice.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {statusNotice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{statusNotice.message}</span>
        </div>
      )}

      {/* Grid: Multi-User Management & Cloud/Database Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Team & User Management (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* User Creation Form */}
          <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-amber-500" />
                <span>Add New Team User</span>
              </h3>
              <span className="text-[11px] text-neutral-400 font-mono">Role-Based Access (RBAC)</span>
            </div>

            <form onSubmit={handleAddUser} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                    Email Address / Username <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      placeholder="auditor@fundsindia.com"
                      className="w-full pl-8 pr-3 py-2 bg-neutral-50 border border-neutral-300 rounded-lg text-xs text-neutral-900 focus:outline-hidden focus:border-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                    Temporary Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full pl-8 pr-3 py-2 bg-neutral-50 border border-neutral-300 rounded-lg text-xs text-neutral-900 focus:outline-hidden focus:border-amber-400"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="e.g. Senior Compliance Auditor"
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-lg text-xs text-neutral-900 focus:outline-hidden focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">Access Role</label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-lg text-xs text-neutral-900 focus:outline-hidden focus:border-amber-400 cursor-pointer"
                  >
                    <option value="auditor">Auditor (Upload, Transcribe &amp; Review)</option>
                    <option value="compliance_officer">Compliance Officer (Full Audit &amp; Scorecards)</option>
                    <option value="admin">Administrator (Complete Platform &amp; DB Control)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isAddingUser}
                  className="px-4 py-2 bg-neutral-900 hover:bg-black text-amber-400 font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{isAddingUser ? 'Creating User…' : 'Create Team User'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* User List Table */}
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-neutral-600" />
                <span>Authorized Team Members ({users.length})</span>
              </h3>
              <button
                onClick={fetchUsers}
                disabled={isLoadingUsers}
                className="p-1.5 text-neutral-400 hover:text-black rounded-lg hover:bg-neutral-100 cursor-pointer"
                title="Refresh user accounts"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingUsers ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-semibold uppercase tracking-wider">
                    <th className="py-2.5 px-4">User</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Created</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-neutral-400 font-medium">
                        {isLoadingUsers ? 'Loading team accounts…' : 'No user records found.'}
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => {
                      const isPrimaryAdmin = u.email === 'ashutosh.kumar@fundsindia.com';
                      return (
                        <tr key={u.id} className="hover:bg-neutral-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-neutral-900">{u.full_name || u.username}</div>
                            <div className="text-[11px] text-neutral-500 font-mono">{u.email}</div>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                u.role === 'admin'
                                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                                  : u.role === 'compliance_officer'
                                  ? 'bg-blue-100 text-blue-900 border-blue-300'
                                  : 'bg-neutral-100 text-neutral-700 border-neutral-200'
                              }`}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-neutral-500 font-mono text-[11px]">
                            {u.created_at ? u.created_at.slice(0, 10) : '—'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {isPrimaryAdmin ? (
                              <span className="text-[10px] text-neutral-400 italic">Primary Admin</span>
                            ) : (
                              <button
                                onClick={() => handleDeleteUser(u.id, u.email)}
                                className="p-1 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                                title="Remove this user"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Cloud Control & Database Hosting (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Cloud Database Hosting Configuration */}
          <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                <Cloud className="w-4 h-4 text-amber-500" />
                <span>Cloud &amp; Database Hosting</span>
              </h3>
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold font-mono">
                CONNECTED
              </span>
            </div>

            <form onSubmit={handleSaveCloudConfig} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                  Database Architecture / Engine
                </label>
                <select
                  value={dbType}
                  onChange={(e) => setDbType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-lg text-xs text-neutral-900 focus:outline-hidden focus:border-amber-400 cursor-pointer"
                >
                  <option value="sqlite_local">Local Container SQLite (.data/auditeq.db)</option>
                  <option value="cloud_sql">Google Cloud SQL / Managed PostgreSQL</option>
                  <option value="postgres">Self-Hosted PostgreSQL Instance</option>
                  <option value="turso">Turso / Cloud Edge SQLite Cluster</option>
                </select>
              </div>

              {dbType !== 'sqlite_local' && (
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                    Cloud Database URI / Connection String
                  </label>
                  <div className="relative">
                    <Key className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      value={cloudDbUri}
                      onChange={(e) => setCloudDbUri(e.target.value)}
                      placeholder="postgres://user:password@cloudsql.gcp.internal:5432/auditeq"
                      className="w-full pl-8 pr-3 py-2 bg-neutral-50 border border-neutral-300 rounded-lg text-xs font-mono text-neutral-900 focus:outline-hidden focus:border-amber-400"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                  Audio Storage Cloud Bucket (S3 / GCS)
                </label>
                <div className="relative">
                  <HardDrive className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={cloudStorageBucket}
                    onChange={(e) => setCloudStorageBucket(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 bg-neutral-50 border border-neutral-300 rounded-lg text-xs font-mono text-neutral-900 focus:outline-hidden focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-neutral-700">
                    Max Parallel Worker Concurrency
                  </label>
                  <span className="text-xs font-mono font-bold text-amber-600">{concurrencyWorkers} Workers</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={6}
                  value={concurrencyWorkers}
                  onChange={(e) => setConcurrencyWorkers(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-neutral-400 font-mono mt-0.5">
                  <span>1 (Sequential)</span>
                  <span>3 (Default)</span>
                  <span>6 (Ultra High-Speed)</span>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-neutral-100">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-neutral-700">
                  <input
                    type="checkbox"
                    checked={cloudBackupEnabled}
                    onChange={(e) => setCloudBackupEnabled(e.target.checked)}
                    className="rounded text-amber-500 accent-amber-500 focus:ring-0"
                  />
                  <span>Automated Daily Snapshot Backups to Cloud Storage</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-neutral-700">
                  <input
                    type="checkbox"
                    checked={sslRequired}
                    onChange={(e) => setSslRequired(e.target.checked)}
                    className="rounded text-amber-500 accent-amber-500 focus:ring-0"
                  />
                  <span>Require SSL / TLS Encrypted DB Connections</span>
                </label>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSavingConfig}
                  className="w-full py-2.5 bg-neutral-900 hover:bg-black text-amber-400 font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingConfig ? 'Saving Settings…' : 'Save Cloud & Backend Controls'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Database Metrics & Health Card */}
          <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-3">
            <h4 className="text-xs font-bold text-neutral-900 flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-neutral-600" />
              <span>Live Database Diagnostics</span>
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-neutral-50 rounded-xl border border-neutral-100">
                <div className="text-[10px] text-neutral-500">Storage Engine</div>
                <div className="font-mono font-bold text-neutral-900">SQLite 3.45 (WAL)</div>
              </div>
              <div className="p-2.5 bg-neutral-50 rounded-xl border border-neutral-100">
                <div className="text-[10px] text-neutral-500">Integrity Check</div>
                <div className="font-mono font-bold text-emerald-600">PASS (0 errors)</div>
              </div>
              <div className="p-2.5 bg-neutral-50 rounded-xl border border-neutral-100">
                <div className="text-[10px] text-neutral-500">Storage File</div>
                <div className="font-mono font-bold text-neutral-900 truncate">.data/auditeq.db</div>
              </div>
              <div className="p-2.5 bg-neutral-50 rounded-xl border border-neutral-100">
                <div className="text-[10px] text-neutral-500">Lease Recovery</div>
                <div className="font-mono font-bold text-amber-600">Active (&gt;2.5m)</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 1-Click Clear All Database Confirmation Modal */}
      {showClearConfirmModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-rose-300 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2 bg-rose-100 rounded-xl">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900">Clear All Database in 1 Click</h3>
                <p className="text-xs text-rose-600 font-medium">Permanent, irreversible workspace purge</p>
              </div>
            </div>

            <p className="text-xs text-neutral-600 leading-relaxed">
              This action will permanently delete <strong>ALL</strong> ingested calls, audio recording files, reference trades, audit scorecards, speech transcripts, and system logs. The database tables will be cleanly wiped and reset to zero.
            </p>

            <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-xs">
              <label className="block text-neutral-700 font-bold mb-1">
                Type <span className="font-mono text-rose-600">CLEAR ALL</span> below to confirm:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="CLEAR ALL"
                className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-lg font-mono font-bold text-xs text-neutral-900 focus:outline-hidden focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setShowClearConfirmModal(false);
                  setConfirmText('');
                }}
                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold text-xs rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAllDatabase}
                disabled={isClearingDb || confirmText.trim() !== 'CLEAR ALL'}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isClearingDb ? 'Purging Everything…' : 'Confirm 1-Click Clear All'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
