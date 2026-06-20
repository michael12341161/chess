import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Eye, Pencil, Power, PowerOff, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { deleteAdminUser, getAdminUser, listAdminUsers, setAdminUserStatus, updateAdminUser } from '../services/supabase/admin.js';
import { useAuthStore } from '../store/authStore.js';

function displayName(user) {
  return user?.full_name || user?.username || user?.email?.split('@')[0] || 'Unnamed user';
}

function formatDate(value) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function shortId(id) {
  return id ? `${id.slice(0, 8)}...` : 'Unknown';
}

function StatusBadge({ status }) {
  const normalized = status === 'inactive' ? 'inactive' : 'active';
  return <span className={`admin-status-badge ${normalized}`}>{normalized}</span>;
}

function RoleBadge({ role }) {
  const normalized = role === 'admin' ? 'admin' : 'user';
  return <span className={`admin-role-badge ${normalized}`}>{normalized}</span>;
}

export default function AdminDashboard() {
  const auth = useAuthStore();
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({ search: '', status: 'all', role: 'all' });
  const [loading, setLoading] = useState(true);
  const [actionUserId, setActionUserId] = useState(null);
  const [detailsUser, setDetailsUser] = useState(null);
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({ full_name: '', email: '', role: 'user', account_status: 'active' });

  const adminToken = auth.adminAccessToken;
  const totalActive = useMemo(() => users.filter((user) => user.account_status === 'active').length, [users]);
  const totalAdmins = useMemo(() => users.filter((user) => user.role === 'admin').length, [users]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const response = await listAdminUsers(adminToken, filters);
    if (response.error) {
      toast.error(response.error.message);
    } else {
      setUsers(response.data);
    }
    setLoading(false);
  }, [adminToken, filters]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadUsers();
    }, 180);
    return () => window.clearTimeout(timeout);
  }, [loadUsers]);

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const refresh = () => {
    void loadUsers();
  };

  const viewUser = async (user) => {
    setActionUserId(user.user_id);
    const response = await getAdminUser(adminToken, user.user_id);
    setActionUserId(null);
    if (response.error) {
      toast.error(response.error.message);
      return;
    }
    setDetailsUser(response.data);
  };

  const openEdit = (user) => {
    setEditUser(user);
    setEditForm({
      full_name: displayName(user),
      email: user.email ?? '',
      role: user.role === 'admin' ? 'admin' : 'user',
      account_status: user.account_status === 'inactive' ? 'inactive' : 'active',
    });
  };

  const saveEdit = async (event) => {
    event.preventDefault();
    if (!editUser) return;

    setActionUserId(editUser.user_id);
    const response = await updateAdminUser(adminToken, editUser.user_id, editForm);
    setActionUserId(null);
    if (response.error) {
      toast.error(response.error.message);
      return;
    }

    toast.success('User updated');
    setEditUser(null);
    setUsers((current) => current.map((user) => (user.user_id === response.data.user_id ? response.data : user)));
  };

  const toggleStatus = async (user) => {
    const nextStatus = user.account_status === 'active' ? 'inactive' : 'active';
    setActionUserId(user.user_id);
    const response = await setAdminUserStatus(adminToken, user.user_id, nextStatus);
    setActionUserId(null);
    if (response.error) {
      toast.error(response.error.message);
      return;
    }

    toast.success(nextStatus === 'active' ? 'User activated' : 'User deactivated');
    setUsers((current) => current.map((row) => (row.user_id === response.data.user_id ? response.data : row)));
  };

  const removeUser = async (user) => {
    if (!window.confirm(`Delete ${displayName(user)}? This removes the account and related profile data.`)) return;

    setActionUserId(user.user_id);
    const response = await deleteAdminUser(adminToken, user.user_id);
    setActionUserId(null);
    if (response.error) {
      toast.error(response.error.message);
      return;
    }

    toast.success('User deleted');
    setUsers((current) => current.filter((row) => row.user_id !== user.user_id));
  };

  return (
    <div className="admin-page">
      <section className="admin-header-panel panel">
        <div>
          <h1>Admin Dashboard</h1>
          <p className="muted">Manage registered users, roles, and account access.</p>
        </div>
        <button type="button" className="icon-button" onClick={refresh} disabled={loading}>
          <RefreshCw size={17} />
          <span>Refresh</span>
        </button>
      </section>

      <section className="admin-summary-grid" aria-label="User totals">
        <span>
          Total users
          <strong>{users.length}</strong>
        </span>
        <span>
          Active
          <strong>{totalActive}</strong>
        </span>
        <span>
          Admins
          <strong>{totalAdmins}</strong>
        </span>
      </section>

      <section className="admin-controls panel">
        <label className="admin-search-label">
          Search users
          <span className="admin-search-input">
            <Search size={17} />
            <input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Name, email, or ID" />
          </span>
        </label>
        <label>
          Status
          <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
        <label>
          Role
          <select value={filters.role} onChange={(event) => updateFilter('role', event.target.value)}>
            <option value="all">All roles</option>
            <option value="admin">Admin</option>
            <option value="user">User</option>
          </select>
        </label>
      </section>

      <section className="panel admin-table-panel">
        <div className="table-scroll admin-table-scroll">
          <table className="admin-users-table">
            <thead>
              <tr>
                <th>User ID</th>
                <th>Full Name</th>
                <th>Email Address</th>
                <th>Role</th>
                <th>Account Status</th>
                <th>Date Registered</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="admin-empty-cell">Loading users.</td>
                </tr>
              ) : users.length ? (
                users.map((user) => {
                  const busy = actionUserId === user.user_id;
                  return (
                    <tr key={user.user_id}>
                      <td><code className="admin-user-id">{shortId(user.user_id)}</code></td>
                      <td>{displayName(user)}</td>
                      <td>{user.email || 'No email'}</td>
                      <td><RoleBadge role={user.role} /></td>
                      <td><StatusBadge status={user.account_status} /></td>
                      <td>{formatDate(user.date_registered)}</td>
                      <td>
                        <div className="admin-row-actions">
                          <button type="button" className="square-icon-button" onClick={() => void viewUser(user)} disabled={busy} title="View user details">
                            <Eye size={16} />
                          </button>
                          <button type="button" className="square-icon-button" onClick={() => openEdit(user)} disabled={busy} title="Edit user">
                            <Pencil size={16} />
                          </button>
                          <button type="button" className="square-icon-button" onClick={() => void toggleStatus(user)} disabled={busy} title={user.account_status === 'active' ? 'Deactivate user' : 'Activate user'}>
                            {user.account_status === 'active' ? <PowerOff size={16} /> : <Power size={16} />}
                          </button>
                          <button type="button" className="square-icon-button danger-button" onClick={() => void removeUser(user)} disabled={busy} title="Delete user">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className="admin-empty-cell">No users match the current filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {detailsUser ? (
        <dialog open className="modal-backdrop admin-modal-backdrop" aria-label="User details">
          <section className="modal admin-detail-modal">
            <button type="button" className="square-icon-button auth-modal-close" onClick={() => setDetailsUser(null)} title="Close">
              <X size={18} />
            </button>
            <div className="modal-title">
              <h2>User Details</h2>
            </div>
            <div className="admin-detail-grid">
              <span>User ID <strong>{detailsUser.user_id}</strong></span>
              <span>Full Name <strong>{displayName(detailsUser)}</strong></span>
              <span>Email <strong>{detailsUser.email || 'No email'}</strong></span>
              <span>Username <strong>{detailsUser.username || 'Not set'}</strong></span>
              <span>Role <strong>{detailsUser.role}</strong></span>
              <span>Status <strong>{detailsUser.account_status}</strong></span>
              <span>Registered <strong>{formatDate(detailsUser.date_registered)}</strong></span>
              <span>Ranking <strong>{detailsUser.ranking_points ?? 0} points</strong></span>
              <span>Record <strong>{detailsUser.wins ?? 0}W / {detailsUser.losses ?? 0}L / {detailsUser.draws ?? 0}D</strong></span>
            </div>
          </section>
        </dialog>
      ) : null}

      {editUser ? (
        <dialog open className="modal-backdrop admin-modal-backdrop" aria-label="Edit user">
          <section className="modal admin-edit-modal">
            <button type="button" className="square-icon-button auth-modal-close" onClick={() => setEditUser(null)} title="Close">
              <X size={18} />
            </button>
            <div className="modal-title">
              <h2>Edit User</h2>
            </div>
            <form className="admin-edit-form" onSubmit={saveEdit}>
              <label>
                Full Name
                <input value={editForm.full_name} onChange={(event) => setEditForm((current) => ({ ...current, full_name: event.target.value }))} required />
              </label>
              <label>
                Email Address
                <input type="email" value={editForm.email} onChange={(event) => setEditForm((current) => ({ ...current, email: event.target.value }))} required />
              </label>
              <label>
                Role
                <select value={editForm.role} onChange={(event) => setEditForm((current) => ({ ...current, role: event.target.value }))}>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <label>
                Account Status
                <select value={editForm.account_status} onChange={(event) => setEditForm((current) => ({ ...current, account_status: event.target.value }))}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setEditUser(null)}>Cancel</button>
                <button type="submit" className="primary-button" disabled={actionUserId === editUser.user_id}>Save changes</button>
              </div>
            </form>
          </section>
        </dialog>
      ) : null}
    </div>
  );
}