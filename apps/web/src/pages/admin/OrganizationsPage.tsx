import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { Globe, Plus, Palette, Building, Users, Check, ShieldAlert } from 'lucide-react';
import { fetchApi } from '../../services/api';

export const OrganizationsPage: React.FC = () => {
  const { user } = useAuth();
  const { tenant, applyThemeColor } = useTenant();

  const [organizations, setOrganizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New Org Form
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [themeColor, setThemeColor] = useState('#16a34a');
  const [logoUrl, setLogoUrl] = useState('');

  const isPlatformAdmin = user?.role === 'PLATFORM_ADMIN';

  const loadOrganizations = async () => {
    try {
      setLoading(true);
      const data = await fetchApi<any[]>('/organizations');
      setOrganizations(data);
    } catch (err) {
      console.error('Failed to load organizations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrganizations();
  }, []);

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchApi('/organizations', {
        method: 'POST',
        body: JSON.stringify({
          name,
          code,
          subdomain,
          themeColor,
          logoUrl,
        }),
      });

      setShowCreateModal(false);
      setName('');
      setCode('');
      setSubdomain('');
      loadOrganizations();
    } catch (err: any) {
      alert(err.message || 'Failed to create organization');
    }
  };

  const handleUpdateBranding = async (orgId: string, color: string, logo: string) => {
    try {
      await fetchApi(`/organizations/${orgId}/branding`, {
        method: 'PATCH',
        body: JSON.stringify({ themeColor: color, logoUrl: logo }),
      });

      applyThemeColor(color);
      alert('White-label brand theme tokens updated successfully!');
      loadOrganizations();
    } catch (err: any) {
      alert(err.message || 'Failed to update white-label branding');
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-2">
            <Globe className="w-6 h-6 text-emerald-600" />
            <span>Multi-Tenant Organizations & Dynamic White-Labeling</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage enterprise tenant subdomains, isolation policies, and custom CSS color themes.
          </p>
        </div>

        {isPlatformAdmin && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow flex items-center space-x-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Tenant Org</span>
          </button>
        )}
      </div>

      {/* Organizations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {organizations.map(org => (
          <div key={org.id} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xl text-white shadow-sm"
                  style={{ backgroundColor: org.themeColor || '#16a34a' }}
                >
                  {org.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{org.name}</h3>
                  <div className="text-xs text-slate-400 font-mono">
                    {org.subdomain}.deskbooking.com
                  </div>
                </div>
              </div>

              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {org.code}
              </span>
            </div>

            {/* Branding Settings Form */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                <Palette className="w-4 h-4 text-emerald-600" />
                <span>Dynamic White-Label Brand Tokens</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Theme Color</label>
                  <input
                    type="color"
                    defaultValue={org.themeColor || '#16a34a'}
                    onChange={e => {
                      const color = e.target.value;
                      handleUpdateBranding(org.id, color, org.logoUrl || '');
                    }}
                    className="w-full h-9 p-1 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Corporate Logo URL</label>
                  <input
                    type="text"
                    defaultValue={org.logoUrl || ''}
                    onBlur={e => {
                      const logo = e.target.value;
                      handleUpdateBranding(org.id, org.themeColor || '#16a34a', logo);
                    }}
                    placeholder="https://logo.png"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create Org Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Register New Tenant Organization</h3>

            <form onSubmit={handleCreateOrg} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Organization Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Acme Global Inc"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Organization Code</label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  placeholder="ACME"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Subdomain Slug</label>
                <input
                  type="text"
                  required
                  value={subdomain}
                  onChange={e => setSubdomain(e.target.value.toLowerCase())}
                  placeholder="acme"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow"
                >
                  Create Tenant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
