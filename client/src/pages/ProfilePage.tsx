import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useAuthStore } from '../stores/authStore';

export default function ProfilePage() {
  const { user, logout, changePassword } = useAuthStore();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');

    if (newPassword.length < 8) {
      setPwError('New password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwError('Passwords do not match');
      return;
    }

    setPwLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPwSuccess('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwError(err.message || 'Failed to change password');
    } finally {
      setPwLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="max-w-md mx-auto space-y-6">
        {/* User Info */}
        <div className="bg-surface rounded-xl border border-border p-6">
          <h1 className="text-2xl font-semibold text-text-primary mb-4">Profile</h1>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm text-text-muted">Username</dt>
              <dd className="text-text-primary">{user?.username}</dd>
            </div>
            <div>
              <dt className="text-sm text-text-muted">Email</dt>
              <dd className="text-text-primary">{user?.email}</dd>
            </div>
            <div>
              <dt className="text-sm text-text-muted">Role</dt>
              <dd className="text-text-primary capitalize">{user?.role}</dd>
            </div>
          </dl>

          <button
            onClick={handleLogout}
            className="mt-6 w-full py-2 rounded-lg border border-destructive text-destructive font-medium hover:bg-destructive/10 transition-colors"
          >
            Sign Out
          </button>
        </div>

        {/* Change Password */}
        <div className="bg-surface rounded-xl border border-border p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Change Password</h2>

          {pwError && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {pwError}
            </div>
          )}
          {pwSuccess && (
            <div className="mb-4 p-3 rounded-lg bg-success/10 text-success text-sm">
              {pwSuccess}
            </div>
          )}

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">Current Password</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm text-text-secondary mb-1">New Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm text-text-secondary mb-1">Confirm New Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:border-primary"
              />
            </div>

            <button
              type="submit"
              disabled={pwLoading}
              className="w-full py-2 rounded-lg bg-primary text-white font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {pwLoading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
