import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { Palette, Check, Shield, Search, Upload, Image as ImageIcon, Sparkles } from 'lucide-react';
import { fetchApi } from '../../services/api';

export const BrandSettingsPage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const { tenant, applyThemeColor, setTenantSubdomain } = useTenant();

  const activeOrg = user?.organization || tenant;

  const [themeColor, setThemeColor] = useState(activeOrg?.themeColor || '#16a34a');
  const [logoUrl, setLogoUrl] = useState(activeOrg?.logoUrl || '');
  const [colorSearch, setColorSearch] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (activeOrg) {
      setThemeColor(activeOrg.themeColor || '#16a34a');
      setLogoUrl(activeOrg.logoUrl || '');
    }
  }, [user, tenant]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg('Image size must be smaller than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoUrl(reader.result as string);
      setSuccessMsg('Logo image loaded. Click "Save Brand Settings" to apply.');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);
    setLoading(true);

    try {
      const orgId = user?.organizationId || activeOrg?.id;
      if (!orgId) throw new Error('Organization ID not found');

      await fetchApi(`/organizations/${orgId}/branding`, {
        method: 'PATCH',
        body: JSON.stringify({
          themeColor,
          logoUrl,
        }),
      });

      applyThemeColor(themeColor);
      if (activeOrg?.subdomain) {
        setTenantSubdomain(activeOrg.subdomain);
      }
      if (refreshUser) {
        await refreshUser();
      }
      setSuccessMsg('White-label brand theme tokens updated successfully!');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update brand settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-2">
          <Palette className="w-6 h-6 text-emerald-600" />
          <span>White-Label Brand Settings</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Customize theme colors, workspace identity, and corporate logo images for your organization.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2">
            <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
            <Shield className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSaveBranding} className="space-y-6">
          {/* Active Workspace Banner */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Organization Workspace</div>
              <div className="text-base font-extrabold text-slate-900 mt-0.5">{activeOrg?.name}</div>
            </div>
            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 font-mono font-bold text-xs rounded-full">
              {activeOrg?.subdomain ? `${activeOrg.subdomain}.deskbooking.com` : 'subdomain'}
            </span>
          </div>

          {/* Color Wheel Section */}
          <div className="space-y-4 border-t border-slate-100 pt-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <label className="text-xs font-extrabold text-slate-800 flex items-center space-x-1.5 uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Interactive Rainbow Color Wheel &amp; Search</span>
              </label>

              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={colorSearch}
                  onChange={e => {
                    setColorSearch(e.target.value);
                    if (e.target.value.startsWith('#') && (e.target.value.length === 4 || e.target.value.length === 7)) {
                      setThemeColor(e.target.value);
                      applyThemeColor(e.target.value);
                    }
                  }}
                  placeholder="Search or enter hex (#2563eb)..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Round Rainbow Color Picker Wheel */}
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-around gap-6">
              
              {/* Circular Color Spectrum Ring Wheel */}
              <div className="flex items-center space-x-5">
                <div className="relative flex items-center justify-center">
                  <div 
                    className="w-24 h-24 rounded-full p-1 shadow-lg transition-transform hover:scale-105"
                    style={{
                      background: 'conic-gradient(from 0deg, red, yellow, lime, cyan, blue, magenta, red)'
                    }}
                  >
                    <input
                      type="color"
                      value={themeColor}
                      onChange={e => {
                        setThemeColor(e.target.value);
                        applyThemeColor(e.target.value);
                      }}
                      className="w-full h-full rounded-full opacity-0 cursor-pointer"
                    />
                  </div>
                  <div 
                    className="absolute w-12 h-12 rounded-full border-4 border-white shadow-md pointer-events-none flex items-center justify-center font-black text-[10px] text-white"
                    style={{ backgroundColor: themeColor }}
                  />
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-extrabold text-slate-900">Circular Rainbow Spectrum Wheel</div>
                  <div className="text-xs text-slate-500">Click anywhere on the ring wheel to select any exact color.</div>
                </div>
              </div>

              {/* Hex Code Token Box */}
              <div className="w-full sm:w-60 bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-2">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Active Theme Token
                </label>
                <div className="flex items-center space-x-2">
                  <div 
                    className="w-7 h-7 rounded-lg border border-slate-300 shadow-inner flex-shrink-0" 
                    style={{ backgroundColor: themeColor }} 
                  />
                  <input
                    type="text"
                    value={themeColor}
                    onChange={e => {
                      setThemeColor(e.target.value);
                      applyThemeColor(e.target.value);
                    }}
                    placeholder="#16a34a"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

            </div>
          </div>

          {/* Logo Image Upload Control */}
          <div className="space-y-3 border-t border-slate-100 pt-4">
            <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              Organization Corporate Logo Upload
            </label>

            <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Corporate Logo Preview"
                  className="w-16 h-16 object-contain rounded-xl border border-slate-200 p-1 bg-white shadow-sm flex-shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-slate-200 text-slate-400 flex items-center justify-center flex-shrink-0">
                  <ImageIcon className="w-8 h-8" />
                </div>
              )}

              <div className="space-y-2 flex-1 w-full">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow cursor-pointer flex items-center space-x-1.5 transition-all">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Image File</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>

                  {logoUrl && (
                    <button
                      type="button"
                      onClick={() => setLogoUrl('')}
                      className="px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                    >
                      Remove Logo
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-slate-500">
                  Supports PNG, JPG, SVG or WEBP formats (max 2MB). Replaces the default initial avatar badge in the top navigation bar.
                </p>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition-all disabled:opacity-50"
            >
              {loading ? 'Saving Changes...' : 'Save Brand Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
